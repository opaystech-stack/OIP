import { randomUUID } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type {
  CapabilityDescriptor,
  CapabilityGatewayResult,
  CapabilityResolution,
} from "@opaystech/oip/capability-gateway";
import type { ExecutionContext, JsonObject, JsonValue } from "@opaystech/oip";

export interface OdooMcpGatewayPort {
  discover(request: { readonly query?: string; readonly capabilityId?: string }): CapabilityResolution;
  invoke(
    request: { readonly query?: string; readonly capabilityId?: string; readonly arguments: JsonObject },
    context: ExecutionContext,
  ): Promise<CapabilityGatewayResult>;
}

export interface OdooMcpContextFactory {
  (input: {
    readonly operation: "discover" | "invoke";
    readonly requestId: string;
    readonly arguments: JsonObject;
  }): ExecutionContext | Promise<ExecutionContext>;
}

export interface OdooMcpServerDependencies {
  readonly gateway: OdooMcpGatewayPort;
  readonly context: OdooMcpContextFactory;
}

/**
 * Official MCP SDK adapter for the public OIP CapabilityGateway contract.
 * It intentionally keeps the host surface to discovery + governed invocation.
 */
export function createOdooMcpServer(dependencies: OdooMcpServerDependencies): McpServer {
  const server = new McpServer(
    {
      name: "oip-odoo-capability-gateway",
      version: "0.1.0-alpha.1",
    },
    {
      instructions: "Search for a registered capability before invoking it. Never claim success without verified evidence.",
    },
  );

  server.registerTool(
    "oip_capability_search",
    {
      title: "Search OIP capabilities",
      description: "Search registered OIP capabilities and setup procedures before attempting execution.",
      inputSchema: {
        query: z.string().min(1),
      },
    },
    async ({ query }) => {
      const requestId = randomUUID();
      await dependencies.context({ operation: "discover", requestId, arguments: { query } });
      return toMcpResult(toPublicResolution(dependencies.gateway.discover({ query })));
    },
  );

  server.registerTool(
    "oip_capability_invoke",
    {
      title: "Invoke a governed OIP capability",
      description: "Invoke only a capability found by search; OIP enforces tenant, policy, validation and verification.",
      inputSchema: {
        query: z.string().min(1).optional(),
        capabilityId: z.string().min(1).optional(),
        arguments: z.record(z.string(), z.unknown()).default({}),
      },
    },
    async ({ query, capabilityId, arguments: rawArguments }) => {
      const arguments_ = toJsonObject(rawArguments);
      const requestId = randomUUID();
      const context = await dependencies.context({ operation: "invoke", requestId, arguments: arguments_ });
      const result = await dependencies.gateway.invoke({
        ...(query !== undefined ? { query } : {}),
        ...(capabilityId !== undefined ? { capabilityId } : {}),
        arguments: arguments_,
      }, context);
      return toMcpResult(result, result.status === "rejected" || result.status === "verification_failed");
    },
  );

  return server;
}

function toMcpResult(payload: unknown, isError = false): {
  readonly content: { readonly type: "text"; readonly text: string }[];
  readonly isError?: true;
} {
  return {
    content: [{ type: "text", text: JSON.stringify(payload) ?? "null" }],
    ...(isError ? { isError: true } : {}),
  };
}

function toPublicResolution(resolution: CapabilityResolution): unknown {
  if (resolution.status === "ambiguous" || resolution.status === "not_found") return resolution;
  const { verification: _verification, ...descriptor } = resolution.descriptor as CapabilityDescriptor;
  return {
    status: resolution.status,
    score: resolution.score,
    capability: descriptor,
    ...(resolution.status === "procedure_available" ? { procedure: resolution.procedure } : {}),
  };
}

function toJsonObject(value: Record<string, unknown>): JsonObject {
  if (!isJsonObject(value)) throw new Error("Capability arguments must be a JSON object.");
  return value;
}

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    && Object.values(value as Record<string, unknown>).every(isJsonValue);
}

function isJsonValue(value: unknown): value is JsonValue {
  if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") return true;
  if (Array.isArray(value)) return value.every(isJsonValue);
  return typeof value === "object" && value !== null && !Array.isArray(value)
    && Object.values(value as Record<string, unknown>).every(isJsonValue);
}
