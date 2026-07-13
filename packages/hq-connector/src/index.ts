import type { JsonObject } from "../../core/src/index.js";
import type { HqConnectorConfig } from "../../config/src/index.js";

/**
 * HQ Connector — service-to-service client that lets OIP consume the read-only
 * capability and audit contract exposed by Opays HQ (commit d882472 / 3ea6d63).
 *
 * Governance boundaries (Blueprint OIP v2):
 * - OIP owns orchestration; it NEVER re-implements HQ business rules.
 * - This connector only *consumes* HQ's documented contract. If HQ rejects a
 *   call (401/403/422), the connector surfaces a typed error and OIP formulates
 *   the user-facing response — it does not second-guess HQ.
 * - The API key is injected from configuration (OIP_API_KEY secret), never
 *   hard-coded, and is sent as the `x-oip-api-key` header.
 */

/** Minimal fetch abstraction so the connector is unit-testable without network. */
export type FetchLike = (
  url: string,
  init: {
    readonly method: "GET" | "POST";
    readonly headers: Record<string, string>;
    readonly body?: string;
    readonly signal?: AbortSignal;
  },
) => Promise<HttpResponse>;

export interface HttpResponse {
  readonly ok: boolean;
  readonly status: number;
  text(): Promise<string>;
  json(): Promise<unknown>;
}

/** A capability advertised by HQ (JSON-Schema derived from Zod). */
export interface HqCapability {
  readonly id: string;
  readonly description?: string;
  readonly inputSchema?: JsonObject;
  readonly requiredRoles?: readonly string[];
}

/** One masked audit row from HQ's read-only observability contract. */
export interface HqExecutionLog {
  readonly actor_role: string;
  readonly capability: string;
  readonly mode: "shadow" | "real";
  readonly ok: boolean;
  readonly duration_ms: number;
  readonly created_at?: string;
}

export interface ExecutionLogQuery {
  readonly capability?: string;
  readonly mode?: "shadow" | "real";
  readonly ok?: boolean;
  readonly from?: string;
  readonly to?: string;
  readonly limit?: number;
  readonly offset?: number;
}

/** Result of executing an HQ capability: either success payload or a typed rejection. */
export type HqExecutionResult =
  | { readonly status: "completed"; readonly httpStatus: number; readonly data: JsonObject }
  | { readonly status: "forbidden"; readonly httpStatus: 403; readonly message: string }
  | { readonly status: "invalid"; readonly httpStatus: 422; readonly message: string; readonly details?: JsonObject }
  | { readonly status: "error"; readonly httpStatus: number; readonly message: string };

/** Raised for transport-level / auth failures the caller should not silently ignore. */
export class HqConnectorError extends Error {
  constructor(
    message: string,
    readonly code:
      | "unauthenticated"
      | "timeout"
      | "network"
      | "malformed_response"
      | "hq_unavailable",
    readonly httpStatus?: number,
  ) {
    super(message);
    this.name = "HqConnectorError";
  }
}

export class HqConnector {
  private readonly fetchImpl: FetchLike;

  constructor(
    private readonly config: HqConnectorConfig,
    fetchImpl?: FetchLike,
  ) {
    this.fetchImpl = fetchImpl ?? defaultFetch;
  }

  /**
   * 1. DISCOVERY — GET /api/oip/capabilities
   * Returns the list of business tools HQ currently exposes.
   */
  async listCapabilities(): Promise<readonly HqCapability[]> {
    const response = await this.request("GET", "/api/oip/capabilities");

    if (response.status === 401) {
      throw new HqConnectorError("HQ rejected the OIP API key.", "unauthenticated", 401);
    }
    if (!response.ok) {
      throw new HqConnectorError(
        `HQ capabilities request failed with status ${response.status}.`,
        "hq_unavailable",
        response.status,
      );
    }

    const payload = await this.parseJson(response);
    const capabilities = extractCapabilityArray(payload);
    return capabilities;
  }

  /**
   * 2. EXECUTION — POST /api/oip/capabilities/:id
   * Executes an HQ capability on behalf of an HQ user (actorId).
   * Business rules stay in HQ: a 403 here means HQ's own hasRole check blocked
   * the action, and OIP simply relays an access-denied outcome.
   */
  async executeCapability(
    capabilityId: string,
    args: JsonObject,
    actorId: string,
  ): Promise<HqExecutionResult> {
    if (!capabilityId) {
      throw new HqConnectorError("capabilityId is required.", "malformed_response");
    }
    if (!actorId) {
      throw new HqConnectorError("actorId is required for capability execution.", "malformed_response");
    }

    const response = await this.request(
      "POST",
      `/api/oip/capabilities/${encodeURIComponent(capabilityId)}`,
      JSON.stringify(args),
      { "x-oip-actor-id": actorId },
    );

    if (response.status === 401) {
      throw new HqConnectorError("HQ rejected the OIP API key.", "unauthenticated", 401);
    }

    if (response.status === 403) {
      return { status: "forbidden", httpStatus: 403, message: await safeMessage(response) };
    }

    if (response.status === 422) {
      const body = await this.parseJsonSafe(response);
      const result: HqExecutionResult = {
        status: "invalid",
        httpStatus: 422,
        message: extractMessage(body) ?? "HQ rejected the arguments (validation error).",
        ...(isJsonObject(body) ? { details: body } : {}),
      };
      return result;
    }

    if (!response.ok) {
      return {
        status: "error",
        httpStatus: response.status,
        message: `HQ execution failed with status ${response.status}.`,
      };
    }

    const payload = await this.parseJson(response);
    return {
      status: "completed",
      httpStatus: response.status,
      data: isJsonObject(payload) ? payload : { result: payload as never },
    };
  }

  /**
   * 3. OBSERVABILITY — GET /api/oip/execution-logs
   * Returns masked audit rows (no actor_id, no business data) for supervision.
   */
  async getExecutionLogs(query: ExecutionLogQuery = {}): Promise<readonly HqExecutionLog[]> {
    const qs = buildQueryString(query);
    const response = await this.request("GET", `/api/oip/execution-logs${qs}`);

    if (response.status === 401) {
      throw new HqConnectorError("HQ rejected the OIP API key.", "unauthenticated", 401);
    }
    if (!response.ok) {
      throw new HqConnectorError(
        `HQ execution-logs request failed with status ${response.status}.`,
        "hq_unavailable",
        response.status,
      );
    }

    const payload = await this.parseJson(response);
    return extractLogArray(payload);
  }

  private async request(
    method: "GET" | "POST",
    path: string,
    body?: string,
    extraHeaders: Record<string, string> = {},
  ): Promise<HttpResponse> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);

    const headers: Record<string, string> = {
      accept: "application/json",
      "x-oip-api-key": this.config.apiKey,
      ...extraHeaders,
    };
    if (body !== undefined) {
      headers["content-type"] = "application/json";
    }

    try {
      const init: {
        method: "GET" | "POST";
        headers: Record<string, string>;
        signal: AbortSignal;
        body?: string;
      } = { method, headers, signal: controller.signal };
      if (body !== undefined) {
        init.body = body;
      }
      return await this.fetchImpl(`${this.config.baseUrl}${path}`, init);
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new HqConnectorError(`HQ request to ${path} timed out.`, "timeout");
      }
      throw new HqConnectorError(
        `HQ request to ${path} failed: ${error instanceof Error ? error.message : String(error)}`,
        "network",
      );
    } finally {
      clearTimeout(timer);
    }
  }

  private async parseJson(response: HttpResponse): Promise<unknown> {
    try {
      return await response.json();
    } catch {
      throw new HqConnectorError("HQ returned a malformed JSON response.", "malformed_response", response.status);
    }
  }

  private async parseJsonSafe(response: HttpResponse): Promise<unknown> {
    try {
      return await response.json();
    } catch {
      return undefined;
    }
  }
}

const defaultFetch: FetchLike = async (url, init) => {
  const response = await fetch(url, init);
  return {
    ok: response.ok,
    status: response.status,
    text: () => response.text(),
    json: () => response.json() as Promise<unknown>,
  };
};

function buildQueryString(query: ExecutionLogQuery): string {
  const params = new URLSearchParams();
  if (query.capability) params.set("capability", query.capability);
  if (query.mode) params.set("mode", query.mode);
  if (query.ok !== undefined) params.set("ok", String(query.ok));
  if (query.from) params.set("from", query.from);
  if (query.to) params.set("to", query.to);
  if (query.limit !== undefined) params.set("limit", String(query.limit));
  if (query.offset !== undefined) params.set("offset", String(query.offset));
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function extractCapabilityArray(payload: unknown): readonly HqCapability[] {
  const rows = Array.isArray(payload)
    ? payload
    : isJsonObject(payload) && Array.isArray(payload.capabilities)
      ? payload.capabilities
      : undefined;

  if (!rows) {
    throw new HqConnectorError(
      "HQ capabilities response did not contain a capabilities array.",
      "malformed_response",
    );
  }

  return rows.filter(isJsonObject).map((row) => {
    const capability: HqCapability = {
      id: typeof row.id === "string" ? row.id : String(row.id ?? ""),
      ...(typeof row.description === "string" ? { description: row.description } : {}),
      ...(isJsonObject(row.inputSchema) ? { inputSchema: row.inputSchema } : {}),
      ...(Array.isArray(row.requiredRoles)
        ? { requiredRoles: row.requiredRoles.filter((r): r is string => typeof r === "string") }
        : {}),
    };
    return capability;
  });
}

function extractLogArray(payload: unknown): readonly HqExecutionLog[] {
  const rows = Array.isArray(payload)
    ? payload
    : isJsonObject(payload) && Array.isArray(payload.logs)
      ? payload.logs
      : isJsonObject(payload) && Array.isArray(payload.data)
        ? payload.data
        : undefined;

  if (!rows) {
    throw new HqConnectorError(
      "HQ execution-logs response did not contain a logs array.",
      "malformed_response",
    );
  }

  return rows.filter(isJsonObject).map((row) => ({
    actor_role: typeof row.actor_role === "string" ? row.actor_role : "unknown",
    capability: typeof row.capability === "string" ? row.capability : "unknown",
    mode: row.mode === "real" ? "real" : "shadow",
    ok: row.ok === true,
    duration_ms: typeof row.duration_ms === "number" ? row.duration_ms : 0,
    ...(typeof row.created_at === "string" ? { created_at: row.created_at } : {}),
  }));
}

function extractMessage(payload: unknown): string | undefined {
  if (isJsonObject(payload)) {
    if (typeof payload.error === "string") return payload.error;
    if (typeof payload.message === "string") return payload.message;
  }
  return undefined;
}

async function safeMessage(response: HttpResponse): Promise<string> {
  try {
    const body = await response.json();
    return extractMessage(body) ?? "Access denied by HQ.";
  } catch {
    return "Access denied by HQ.";
  }
}

export { HqActionRegistry, type HqAction, type HqDiscoveryResult } from "./registry.js";
export { ManifestClient, type SemanticManifest, type ManifestEntity, type ManifestField, type ManifestOperation, type ManifestQuery } from "./manifest.js";
