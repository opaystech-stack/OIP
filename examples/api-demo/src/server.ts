import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { createLlmAdapter, loadLlmConfig } from "../../../packages/config/src/index.js";
import type { JsonObject, RuntimeContext } from "../../../packages/core/src/index.js";
import { ChatService } from "../../../packages/chat-service/src/index.js";
import type { LlmAdapter } from "../../../packages/llm-adapter/src/index.js";
import type { OipRuntime } from "../../../packages/runtime/src/index.js";
import { createRuntimeFromEnv } from "../../../packages/runtime/src/factory.js";
import { commercePluginModule } from "../../plugins/commerce/src/index.js";
import { hrPluginModule } from "../../plugins/hr/src/index.js";

export interface ApiServerOptions {
  readonly port: number;
  /** Inject a runtime configured with a real IdentityRuntime in production. */
  readonly runtime?: OipRuntime;
  readonly llm?: LlmAdapter;
}

export function startApiServer(options: ApiServerOptions): Server {
  const runtime = options.runtime ?? createRuntimeFromEnv().use(commercePluginModule).use(hrPluginModule);
  const chat = new ChatService(runtime, options.llm ?? createLlmAdapter(loadLlmConfig()));

  const server = createServer(async (request, response) => {
    try {
      await routeRequest(request, response, chat, runtime);
    } catch (error) {
      sendJson(response, 500, {
        error: error instanceof Error ? error.message : "Unknown server error",
      });
    }
  });

  server.listen(options.port, () => {
    const address = server.address();
    const port = typeof address === "object" && address ? address.port : options.port;

    console.log(`OIP API listening on http://localhost:${port}`);
  });

  return server;
}

async function routeRequest(
  request: IncomingMessage,
  response: ServerResponse,
  chat: ChatService,
  runtime: OipRuntime,
): Promise<void> {
  if (request.method === "GET" && request.url === "/health") {
    sendJson(response, 200, { status: "ok" });
    return;
  }

  if (request.method === "GET" && request.url === "/capabilities") {
    sendJson(response, 200, { capabilities: runtime.capabilities.list() });
    return;
  }

  if (request.method === "POST" && request.url === "/chat") {
    const body = await readJsonBody(request);
    const input = body.input;

    if (typeof input !== "string" || input.trim().length === 0) {
      sendJson(response, 400, { error: "Field input is required." });
      return;
    }

    const result = await chat.handle({
      input,
      context: createRuntimeContext(body),
      headers: requestHeaders(request),
    });

    sendJson(response, 200, result);
    return;
  }

  if (request.method === "POST" && request.url === "/actions") {
    sendJson(response, 410, {
      error: "Direct capability execution is retired. Submit an intention through the governed runtime.",
    });
    return;
  }

  if (request.method === "POST" && request.url === "/documents") {
    const body = await readJsonBody(request);

    if (typeof body.title !== "string" || typeof body.text !== "string") {
      sendJson(response, 400, { error: "Fields title and text are required." });
      return;
    }

    const result = runtime.documents.ingest({
      title: body.title,
      text: body.text,
      metadata: isJsonObject(body.metadata) ? body.metadata : {},
    });

    sendJson(response, 201, result);
    return;
  }

  if (request.method === "GET" && request.url === "/admin/audit") {
    sendJson(response, 200, { records: await readList(runtime.audit) });
    return;
  }

  if (request.method === "GET" && request.url === "/admin/traces") {
    sendJson(response, 200, { traces: await readList(runtime.observability) });
    return;
  }

  if (request.method === "GET" && request.url === "/admin/events") {
    sendJson(response, 200, { events: await readList(runtime.events) });
    return;
  }

  sendJson(response, 404, { error: "Route not found." });
}

function createRuntimeContext(body: JsonObject): RuntimeContext {
  return {
    requestId: typeof body.requestId === "string" ? body.requestId : crypto.randomUUID(),
    channel: "api",
    user: {
      userId: "gateway",
      organizationId: "unresolved",
      roles: [],
    },
  };
}

function requestHeaders(request: IncomingMessage): { readonly [key: string]: string } {
  const headers: Record<string, string> = {};
  for (const [name, value] of Object.entries(request.headers)) {
    if (typeof value === "string") headers[name] = value;
  }
  return headers;
}

async function readJsonBody(request: IncomingMessage): Promise<JsonObject> {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  if (chunks.length === 0) {
    return {};
  }

  const parsed = JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;

  if (!isJsonObject(parsed)) {
    throw new Error("Request body must be a JSON object.");
  }

  return parsed;
}

function sendJson(response: ServerResponse, statusCode: number, payload: unknown): void {
  response.writeHead(statusCode, { "content-type": "application/json" });
  response.end(JSON.stringify(payload));
}

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function readList(source: { list?: () => unknown }): Promise<unknown> {
  return source.list ? await source.list() : [];
}
