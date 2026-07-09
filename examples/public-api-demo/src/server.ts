import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { JsonValue, OipPublicApi, OipPublicRequest, OipPublicResponse, RuntimeContext } from "../../../packages/public-api/src/index.js";

export interface PublicApiServerOptions {
  readonly port: number;
  readonly api: OipPublicApi;
  readonly version?: string;
}

export function startPublicApiServer(options: PublicApiServerOptions): Server {
  const version = options.version ?? "v1";

  const server = createServer(async (request, response) => {
    try {
      await routeRequest(request, response, options.api, version);
    } catch (error) {
      sendJson(response, 500, {
        requestId: "unknown",
        operation: "unknown",
        status: "error",
        error: {
          code: "internal-error",
          message: error instanceof Error ? error.message : "Unknown server error",
          retryable: true,
          suggestedAction: "retry",
        },
        metadata: { durationMs: 0, version },
      } as OipPublicResponse);
    }
  });

  server.listen(options.port, () => {
    const address = server.address();
    const port = typeof address === "object" && address ? address.port : options.port;
    console.log(`OIP public API listening on http://localhost:${port}`);
  });

  return server;
}

async function routeRequest(
  request: IncomingMessage,
  response: ServerResponse,
  api: OipPublicApi,
  version: string,
): Promise<void> {
  if (request.method === "GET" && request.url === "/health") {
    sendJson(response, 200, { status: "ok", version });
    return;
  }

  if (request.method === "POST" && request.url === "/v1/oip/invoke") {
    const body = await readJsonBody(request);

    if (!isValidInvokeRequest(body)) {
      const bodyObject = isJsonObject(body) ? body : null;
      sendJson(response, 400, {
        requestId: typeof bodyObject?.requestId === "string" ? bodyObject.requestId : "unknown",
        operation: typeof bodyObject?.operation === "string" ? bodyObject.operation : "unknown",
        status: "error",
        error: {
          code: "request.invalid",
          message: "Fields requestId, operation and payload are required.",
          retryable: false,
          suggestedAction: "none",
        },
        metadata: { durationMs: 0, version },
      } as OipPublicResponse);
      return;
    }

    const invokeRequest = buildInvokeRequest(body);
    const result = await api.invoke(invokeRequest);
    const statusCode = mapStatusToHttp(result.status);
    sendJson(response, statusCode, result);
    return;
  }

  sendJson(response, 404, {
    requestId: "unknown",
    operation: "unknown",
    status: "error",
    error: {
      code: "route.not-found",
      message: `Route ${request.method} ${request.url} not found.`,
      retryable: false,
      suggestedAction: "none",
    },
    metadata: { durationMs: 0, version },
  } as OipPublicResponse);
}

function mapStatusToHttp(status: OipPublicResponse["status"]): number {
  switch (status) {
    case "completed":
      return 200;
    case "pending":
      return 202;
    case "rejected":
      return 403;
    case "error":
    default:
      return 400;
  }
}

function buildInvokeRequest(body: Record<string, unknown> & { requestId: string; operation: string; payload: Record<string, unknown> }): OipPublicRequest {
  const invokeRequest: OipPublicRequest = {
    requestId: body.requestId,
    operation: body.operation,
    payload: body.payload as Record<string, JsonValue>,
  } as OipPublicRequest;

  if (typeof body.timeoutMs === "number") {
    (invokeRequest as OipPublicRequest & { timeoutMs: number }).timeoutMs = body.timeoutMs;
  }

  if (typeof body.correlationId === "string") {
    (invokeRequest as OipPublicRequest & { correlationId: string }).correlationId = body.correlationId;
  }

  if (isRuntimeContext(body.context)) {
    const context = body.context as RuntimeContext;
    (invokeRequest as OipPublicRequest & { context: RuntimeContext }).context = context;
  }

  return invokeRequest;
}

function isValidInvokeRequest(body: unknown): body is Record<string, unknown> & {
  requestId: string;
  operation: string;
  payload: Record<string, unknown>;
} {
  return (
    isJsonObject(body) &&
    typeof body.requestId === "string" &&
    typeof body.operation === "string" &&
    isJsonObject(body.payload)
  );
}

function isRuntimeContext(value: unknown): value is OipPublicRequest["context"] {
  if (!isJsonObject(value)) {
    return false;
  }

  const user = value.user;
  if (!isJsonObject(user)) {
    return false;
  }

  return (
    typeof value.requestId === "string" &&
    typeof value.channel === "string" &&
    typeof user.userId === "string" &&
    typeof user.organizationId === "string" &&
    Array.isArray(user.roles) &&
    user.roles.every((role) => typeof role === "string")
  );
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  if (chunks.length === 0) {
    return {};
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
}

function sendJson(response: ServerResponse, statusCode: number, payload: unknown): void {
  response.writeHead(statusCode, { "content-type": "application/json" });
  response.end(JSON.stringify(payload));
}
