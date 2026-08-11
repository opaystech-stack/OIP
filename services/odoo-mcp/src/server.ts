import { randomUUID, timingSafeEqual } from "node:crypto";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { CapabilityGatewayAudit } from "@opaystech/oip/capability-gateway";
import { createOdooMcpServer } from "./mcp.js";
import { createGoogleWorkspaceClient, type GoogleWorkspaceExecutor } from "./google-workspace.js";
import { createOdooGateway, JsonLineCapabilityAudit, OIP_ORGANIZATION_ID, OIP_RELEASE } from "./capabilities.js";
import { OdooJsonRpcClient, type OdooExecutor } from "./odoo-jsonrpc.js";

export interface OdooMcpServerConfig {
  readonly port: number;
  readonly mcpAuthToken: string;
  readonly odooUrl: string;
  readonly odooDatabase: string;
  readonly odooUsername: string;
  readonly odooPassword: string;
  readonly organizationId: string;
  readonly roles: readonly string[];
  readonly requiredRole: string;
  readonly googleWorkspace?: GoogleWorkspaceExecutor;
  readonly audit?: CapabilityGatewayAudit;
}

export interface OdooMcpDependencyOverrides {
  readonly executor?: OdooExecutor;
  readonly serviceUid?: number;
  readonly googleWorkspace?: GoogleWorkspaceExecutor;
}

export interface OdooMcpApplication {
  readonly server: Server;
  readonly port: number;
  readonly serviceUid: number;
  readonly close: () => Promise<void>;
}

type OdooMcpServer = ReturnType<typeof createOdooMcpServer>;

interface OdooMcpSession {
  readonly transport: StreamableHTTPServerTransport;
  readonly mcpServer: OdooMcpServer;
}

export function loadOdooMcpConfig(env: NodeJS.ProcessEnv = process.env): OdooMcpServerConfig {
  const googleWorkspace = loadGoogleWorkspace(env);
  return {
    port: parsePort(env.PORT ?? "3000"),
    mcpAuthToken: env.MCP_SERVICE_TOKEN ?? requiredEnv(env, "MCP_AUTH_TOKEN"),
    odooUrl: requiredEnv(env, "ODOO_URL"),
    odooDatabase: env.ODOO_DB ?? "opays_hq",
    odooUsername: requiredEnv(env, "ODOO_USER"),
    odooPassword: requiredEnv(env, "ODOO_PASSWORD"),
    organizationId: env.OIP_ORGANIZATION_ID ?? OIP_ORGANIZATION_ID,
    roles: parseRoles(env.OIP_ROLES ?? "oip.service"),
    requiredRole: env.OIP_REQUIRED_ROLE ?? "oip.service",
    ...(googleWorkspace !== undefined ? { googleWorkspace } : {}),
    audit: new JsonLineCapabilityAudit(),
  };
}

export async function createOdooMcpApplication(
  config: OdooMcpServerConfig,
  overrides: OdooMcpDependencyOverrides = {},
): Promise<OdooMcpApplication> {
  const client = overrides.executor ?? new OdooJsonRpcClient({
    baseUrl: config.odooUrl,
    database: config.odooDatabase,
    username: config.odooUsername,
    password: config.odooPassword,
  });
  const serviceUid = overrides.serviceUid ?? await authenticateExecutor(client);
  const googleWorkspace = overrides.googleWorkspace ?? config.googleWorkspace;
  const gatewayOptions = {
    client,
    serviceUid,
    database: config.odooDatabase,
    organizationId: config.organizationId,
    roles: config.roles,
    requiredRole: config.requiredRole,
    ...(googleWorkspace !== undefined ? { googleWorkspace } : {}),
    ...(config.audit !== undefined ? { audit: config.audit } : {}),
  };
  const bundle = createOdooGateway(gatewayOptions);
  const sessions = new Map<string, OdooMcpSession>();
  const createSession = async (): Promise<OdooMcpSession> => {
    const mcpServer = createOdooMcpServer({
      gateway: bundle.gateway,
      context: bundle.contextFactory,
    });
    // Stateful Streamable HTTP is required here because MCP clients send initialize,
    // notifications/initialized, and tool calls as separate HTTP requests.
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: randomUUID });
    // SDK 1.30.x declares optional transport callbacks as required under this repo's
    // exactOptionalPropertyTypes setting; the runtime transport is the official SDK type.
    await mcpServer.connect(transport as never);
    const session: OdooMcpSession = { transport, mcpServer };
    transport.onclose = () => {
      const sessionId = transport.sessionId;
      if (sessionId !== undefined && sessions.get(sessionId) === session) sessions.delete(sessionId);
    };
    return session;
  };

  const server = createServer(async (request, response) => {
    try {
      await routeRequest(request, response, sessions, createSession, config.mcpAuthToken);
    } catch {
      if (!response.headersSent) {
        sendJson(response, 500, { error: "internal_server_error" });
      } else {
        response.destroy();
      }
    }
  });

  return {
    server,
    port: config.port,
    serviceUid,
    close: async () => {
      const activeSessions = [...sessions.values()];
      await Promise.all(activeSessions.map(async (session) => {
        await session.mcpServer.close();
      }));
      sessions.clear();
      await closeHttpServer(server);
    },
  };
}

export async function startOdooMcpServer(
  config: OdooMcpServerConfig = loadOdooMcpConfig(),
  overrides: OdooMcpDependencyOverrides = {},
): Promise<OdooMcpApplication> {
  const application = await createOdooMcpApplication(config, overrides);
  await new Promise<void>((resolve, reject) => {
    const onError = (error: Error) => {
      application.server.off("error", onError);
      reject(error);
    };
    application.server.once("error", onError);
    application.server.listen(config.port, "0.0.0.0", () => {
      application.server.off("error", onError);
      resolve();
    });
  });
  const address = application.server.address();
  const port = typeof address === "object" && address !== null ? address.port : config.port;
  return { ...application, port };
}

async function routeRequest(
  request: IncomingMessage,
  response: ServerResponse,
  sessions: Map<string, OdooMcpSession>,
  createSession: () => Promise<OdooMcpSession>,
  expectedToken: string,
): Promise<void> {
  const url = new URL(request.url ?? "/", "http://localhost");

  if (request.method === "GET" && (url.pathname === "/health" || url.pathname === "/health/")) {
    sendJson(response, 200, {
      status: "ok",
      service: "odoo-mcp",
      oipRelease: OIP_RELEASE,
    });
    return;
  }

  if (request.method === "OPTIONS" && (url.pathname === "/mcp" || url.pathname === "/mcp/")) {
    response.writeHead(204, {
      "access-control-allow-methods": "GET, POST, DELETE, OPTIONS",
      "access-control-allow-headers": "Authorization, Content-Type, Mcp-Session-Id, Mcp-Protocol-Version, Last-Event-ID",
      "access-control-max-age": "600",
    });
    response.end();
    return;
  }

  if (url.pathname !== "/mcp" && url.pathname !== "/mcp/") {
    sendJson(response, 404, { error: "not_found" });
    return;
  }

  if (!isBearerAuthorized(request.headers.authorization, expectedToken)) {
    sendJson(response, 401, { error: "unauthorized" });
    return;
  }

  if (request.method !== "GET" && request.method !== "POST" && request.method !== "DELETE") {
    response.writeHead(405, { allow: "GET, POST, DELETE" });
    response.end();
    return;
  }

  const sessionId = headerValue(request.headers["mcp-session-id"]);
  if (sessionId !== undefined) {
    const session = sessions.get(sessionId);
    if (session === undefined) {
      sendJson(response, 404, { error: "mcp_session_not_found" });
      return;
    }
    await session.transport.handleRequest(request, response);
    return;
  }

  if (request.method !== "POST") {
    sendJson(response, 400, { error: "mcp_session_required" });
    return;
  }

  const session = await createSession();
  await session.transport.handleRequest(request, response);
  const createdSessionId = session.transport.sessionId;
  if (createdSessionId !== undefined) sessions.set(createdSessionId, session);
}

function headerValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

function isBearerAuthorized(header: string | undefined, expectedToken: string): boolean {
  if (!header?.startsWith("Bearer ")) return false;
  const actual = Buffer.from(header.slice("Bearer ".length), "utf8");
  const expected = Buffer.from(expectedToken, "utf8");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function sendJson(response: ServerResponse, statusCode: number, payload: unknown): void {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  response.end(JSON.stringify(payload));
}

async function authenticateExecutor(executor: OdooExecutor): Promise<number> {
  const candidate = executor as OdooExecutor & { readonly authenticate?: () => Promise<number> };
  if (typeof candidate.authenticate !== "function") {
    throw new Error("The Odoo executor must authenticate before the MCP service starts.");
  }
  return candidate.authenticate();
}

async function closeHttpServer(server: Server): Promise<void> {
  if (!server.listening) return;
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

function loadGoogleWorkspace(env: NodeJS.ProcessEnv): GoogleWorkspaceExecutor | undefined {
  const clientId = env.GOOGLE_CLIENT_ID;
  const clientSecret = env.GOOGLE_CLIENT_SECRET;
  const refreshToken = env.GOOGLE_REFRESH_TOKEN;
  if (clientId === undefined && clientSecret === undefined && refreshToken === undefined) return undefined;
  if (!clientId || !clientSecret || !refreshToken) throw new Error("Google Workspace OAuth configuration is incomplete.");
  return createGoogleWorkspaceClient({ clientId, clientSecret, refreshToken });
}

function requiredEnv(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function parsePort(value: string): number {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("PORT must be a valid TCP port.");
  return port;
}

function parseRoles(value: string): readonly string[] {
  const roles = value.split(",").map((role) => role.trim()).filter(Boolean);
  if (roles.length === 0) throw new Error("OIP_ROLES must contain at least one role.");
  return roles;
}
