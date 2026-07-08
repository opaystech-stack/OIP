import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { createLlmAdapter, loadLlmConfig } from "../../../packages/config/src/index.js";
import type { JsonObject, RuntimeContext } from "../../../packages/core/src/index.js";
import { ChatService } from "../../../packages/chat-service/src/index.js";
import { OipRuntime } from "../../../packages/runtime/src/index.js";
import { commercePluginModule } from "../../../plugins/commerce/src/index.js";
import { hrPluginModule } from "../../../plugins/hr/src/index.js";

export interface ApiServerOptions {
  readonly port: number;
}

export function startApiServer(options: ApiServerOptions): Server {
  const runtime = new OipRuntime().use(commercePluginModule).use(hrPluginModule);
  const chat = new ChatService(runtime, createLlmAdapter(loadLlmConfig()));

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
    });

    sendJson(response, 200, result);
    return;
  }

  if (request.method === "POST" && request.url === "/actions") {
    const body = await readJsonBody(request);

    if (typeof body.capabilityId !== "string" || !isJsonObject(body.arguments)) {
      sendJson(response, 400, { error: "Fields capabilityId and arguments are required." });
      return;
    }

    const result = await runtime.execute(
      {
        capabilityId: body.capabilityId,
        arguments: body.arguments,
        confidence: typeof body.confidence === "number" ? body.confidence : 1,
        reason: typeof body.reason === "string" ? body.reason : "Direct API action request.",
      },
      createRuntimeContext(body),
    );

    sendJson(response, result.status === "completed" ? 200 : 422, result);
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
    sendJson(response, 200, { records: runtime.audit.list() });
    return;
  }

  if (request.method === "GET" && request.url === "/admin/traces") {
    sendJson(response, 200, { traces: runtime.observability.list() });
    return;
  }

  if (request.method === "GET" && request.url === "/admin/events") {
    sendJson(response, 200, { events: runtime.events.list() });
    return;
  }

  sendJson(response, 404, { error: "Route not found." });
}

function createRuntimeContext(body: JsonObject): RuntimeContext {
  const user = isJsonObject(body.user) ? body.user : {};
  const roles = Array.isArray(user.roles) ? user.roles.filter((role): role is string => typeof role === "string") : [];

  return {
    requestId: typeof body.requestId === "string" ? body.requestId : crypto.randomUUID(),
    channel: "api",
    metadata: {
      confirmedCapabilities: Array.isArray(body.confirmedCapabilities)
        ? body.confirmedCapabilities.filter((capabilityId): capabilityId is string => typeof capabilityId === "string")
        : [],
    },
    user: {
      userId: typeof user.userId === "string" ? user.userId : "api-user",
      organizationId: typeof user.organizationId === "string" ? user.organizationId : "api-org",
      roles,
      locale: typeof user.locale === "string" ? user.locale : "fr-CD",
      activeModule: typeof user.activeModule === "string" ? user.activeModule : "commerce",
      activePage: typeof user.activePage === "string" ? user.activePage : "chat",
    },
  };
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
