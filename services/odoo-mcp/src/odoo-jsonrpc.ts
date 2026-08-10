import type { JsonObject, JsonValue } from "../../../packages/core/src/contracts/common.js";

export interface OdooJsonRpcConfig {
  readonly baseUrl: string;
  readonly database: string;
  readonly username: string;
  readonly password: string;
  readonly timeoutMs?: number;
}

export interface OdooExecutor {
  executeKw(
    model: string,
    method: string,
    args: readonly unknown[],
    kwargs?: JsonObject,
  ): Promise<unknown>;
}

export class OdooJsonRpcError extends Error {
  constructor(
    message: string,
    readonly code: "configuration" | "transport" | "http" | "rpc" | "invalid_response",
    readonly httpStatus?: number,
  ) {
    super(message);
    this.name = "OdooJsonRpcError";
  }
}

interface JsonRpcResponse {
  readonly jsonrpc?: string;
  readonly id?: string | number | null;
  readonly result?: unknown;
  readonly error?: unknown;
}

export class OdooJsonRpcClient implements OdooExecutor {
  private authenticatedUid: number | undefined;
  private readonly timeoutMs: number;
  private readonly baseUrl: string;

  constructor(
    private readonly config: OdooJsonRpcConfig,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {
    if (!config.baseUrl || !config.database || !config.username || !config.password) {
      throw new OdooJsonRpcError("Odoo JSON-RPC configuration is incomplete.", "configuration");
    }

    this.baseUrl = `${config.baseUrl.replace(/\/$/u, "")}/jsonrpc`;
    this.timeoutMs = config.timeoutMs ?? 10_000;
  }

  get database(): string {
    return this.config.database;
  }

  get username(): string {
    return this.config.username;
  }

  get uid(): number | undefined {
    return this.authenticatedUid;
  }

  async authenticate(): Promise<number> {
    const result = await this.call("common", "authenticate", [
      this.config.database,
      this.config.username,
      this.config.password,
      {},
    ]);

    if (typeof result !== "number" || !Number.isInteger(result) || result <= 0) {
      throw new OdooJsonRpcError("Odoo authentication returned no valid user id.", "rpc");
    }

    this.authenticatedUid = result;
    return result;
  }

  async executeKw(
    model: string,
    method: string,
    args: readonly unknown[],
    kwargs: JsonObject = {},
  ): Promise<unknown> {
    const uid = this.authenticatedUid ?? await this.authenticate();
    return this.call("object", "execute_kw", [
      this.config.database,
      uid,
      this.config.password,
      model,
      method,
      args,
      kwargs,
    ]);
  }

  private async call(service: "common" | "object", method: string, args: readonly unknown[]): Promise<unknown> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await this.fetchImpl(this.baseUrl, {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "call",
          params: { service, method, args },
          id: Date.now(),
        }),
        signal: controller.signal,
      });

      const body = await response.text();
      if (!response.ok) {
        throw new OdooJsonRpcError(`Odoo JSON-RPC returned HTTP ${response.status}.`, "http", response.status);
      }

      let payload: JsonRpcResponse;
      try {
        payload = JSON.parse(body) as JsonRpcResponse;
      } catch {
        throw new OdooJsonRpcError("Odoo returned a non-JSON JSON-RPC response.", "invalid_response", response.status);
      }

      if (payload.error !== undefined) {
        throw new OdooJsonRpcError("Odoo rejected the JSON-RPC operation.", "rpc", response.status);
      }

      if (!("result" in payload)) {
        throw new OdooJsonRpcError("Odoo JSON-RPC response has no result.", "invalid_response", response.status);
      }

      return payload.result;
    } catch (error) {
      if (error instanceof OdooJsonRpcError) throw error;
      if (error instanceof Error && error.name === "AbortError") {
        throw new OdooJsonRpcError("Odoo JSON-RPC request timed out.", "transport");
      }
      throw new OdooJsonRpcError("Odoo JSON-RPC request failed.", "transport");
    } finally {
      clearTimeout(timeout);
    }
  }
}

export function toJsonValue(value: unknown): JsonValue {
  if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(toJsonValue);
  }

  if (typeof value === "object") {
    const result: Record<string, JsonValue> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      result[key] = toJsonValue(item);
    }
    return result;
  }

  return String(value);
}

export function toJsonObject(value: unknown): JsonObject {
  const normalized = toJsonValue(value);
  if (typeof normalized !== "object" || normalized === null || Array.isArray(normalized)) {
    throw new OdooJsonRpcError("Odoo returned a non-object result.", "invalid_response");
  }
  return normalized;
}
