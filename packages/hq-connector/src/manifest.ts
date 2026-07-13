import type { JsonObject } from "../../core/src/index.js";
import { HqConnector, HqConnectorError, type HttpResponse, type FetchLike } from "./index.js";
import type { HqConnectorConfig } from "../../config/src/index.js";

/**
 * Semantic Manifest client (ADR-012).
 *
 * Products publish a single /api/oip/manifest endpoint. OIP queries it on-demand
 * to load only the schema of the entity referenced by the current user intention.
 * No tool prompts or capability lists are hard-coded in OIP.
 */

export interface ManifestField {
  readonly type: string;
  readonly required?: boolean;
  readonly readonly?: boolean;
  readonly values?: readonly unknown[];
}

export interface ManifestOperation {
  readonly roles: readonly string[];
  readonly endpoint?: string;
  readonly method?: "POST" | "PATCH" | "PUT" | "GET" | "DELETE";
}

export interface ManifestEntity {
  readonly description?: string;
  readonly fields: Readonly<Record<string, ManifestField>>;
  readonly operations: Readonly<Record<string, ManifestOperation>>;
}

export interface SemanticManifest {
  readonly product: string;
  readonly version: string;
  readonly entities: Readonly<Record<string, ManifestEntity>>;
}

export interface ManifestQuery {
  readonly product?: string;
  readonly entity?: string;
}

export class ManifestClient {
  private readonly fetchImpl: FetchLike;

  constructor(
    private readonly config: HqConnectorConfig,
    fetchImpl?: FetchLike,
  ) {
    this.fetchImpl = fetchImpl ?? defaultFetch;
  }

  /**
   * Load the full semantic manifest, or a filtered one if the product supports
   * query parameters. OIP then extracts only the entity it needs.
   */
  async loadManifest(query?: ManifestQuery): Promise<SemanticManifest> {
    const params = new URLSearchParams();
    if (query?.product) params.set("product", query.product);
    if (query?.entity) params.set("entity", query.entity);
    const qs = params.toString();
    const path = `/api/oip/manifest${qs ? `?${qs}` : ""}`;

    const response = await this.request("GET", path);

    if (response.status === 401) {
      throw new HqConnectorError("HQ rejected the OIP API key.", "unauthenticated", 401);
    }
    if (!response.ok) {
      throw new HqConnectorError(
        `HQ manifest request failed with status ${response.status}.`,
        "hq_unavailable",
        response.status,
      );
    }

    const payload = await parseJson(response);
    return assertManifest(payload);
  }

  private async request(method: "GET", path: string): Promise<HttpResponse> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs ?? 10_000);

    try {
      return await this.fetchImpl(`${this.config.baseUrl}${path}`, {
        method,
        headers: {
          "content-type": "application/json",
          "x-oip-api-key": this.config.apiKey,
        },
        signal: controller.signal,
      });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new HqConnectorError("Request to HQ timed out.", "timeout");
      }
      throw new HqConnectorError(
        `Network error while contacting HQ: ${error instanceof Error ? error.message : String(error)}`,
        "network",
      );
    } finally {
      clearTimeout(timeout);
    }
  }
}

async function parseJson(response: HttpResponse): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new HqConnectorError("HQ returned malformed JSON.", "malformed_response");
  }
}

function assertManifest(payload: unknown): SemanticManifest {
  if (!isObject(payload)) {
    throw new HqConnectorError("HQ manifest is not a JSON object.", "malformed_response");
  }
  const obj = payload as Record<string, unknown>;
  if (typeof obj.product !== "string" || typeof obj.version !== "string") {
    throw new HqConnectorError("HQ manifest missing product or version.", "malformed_response");
  }
  if (!isObject(obj.entities)) {
    throw new HqConnectorError("HQ manifest missing entities object.", "malformed_response");
  }
  return payload as unknown as SemanticManifest;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

const defaultFetch: FetchLike = async (url, init) => {
  const response = await fetch(url, init as RequestInit);
  return {
    ok: response.ok,
    status: response.status,
    text: () => response.text(),
    json: () => response.json(),
  };
};
