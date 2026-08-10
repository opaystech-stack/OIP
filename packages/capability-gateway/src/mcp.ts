import { randomUUID } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import type {
  CapabilityGatewayResult,
  CapabilityInvocationRequest,
  CapabilityProcedure,
  CapabilityQuery,
  CapabilityResolution,
  CapabilityDescriptor,
} from "./index.js";
import type { ExecutionContext } from "../../core/src/contracts/index.js";
import type { JsonObject, JsonValue } from "../../core/src/index.js";

export interface CapabilityGatewayPort {
  discover(request: CapabilityQuery): CapabilityResolution;
  invoke(request: CapabilityInvocationRequest, context: ExecutionContext): Promise<CapabilityGatewayResult>;
}

export interface CapabilityMcpContextInput {
  readonly operation: "discover" | "invoke";
  readonly requestId: string;
  readonly arguments: JsonObject;
}

export type CapabilityMcpContextFactory = (
  input: CapabilityMcpContextInput,
) => ExecutionContext | Promise<ExecutionContext>;

export interface CapabilityMcpServerDependencies {
  readonly gateway: CapabilityGatewayPort;
  /** The host owns authentication and tenant resolution; the model never supplies identity. */
  readonly context: CapabilityMcpContextFactory;
}

export function createCapabilityMcpServer(dependencies: CapabilityMcpServerDependencies): McpServer {
  const server = new McpServer(
    {
      name: "oip-capability-gateway",
      version: "0.1.0",
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
      await dependencies.context({
        operation: "discover",
        requestId,
        arguments: { query },
      });
      const resolution = dependencies.gateway.discover({ query });
      return toMcpResult(toPublicResolution(resolution));
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
      const context = await dependencies.context({
        operation: "invoke",
        requestId,
        arguments: arguments_,
      });
      const request: CapabilityInvocationRequest = {
        ...(query !== undefined ? { query } : {}),
        ...(capabilityId !== undefined ? { capabilityId } : {}),
        arguments: arguments_,
      };
      const result = await dependencies.gateway.invoke(request, context);
      return toMcpResult(result, result.status === "rejected" || result.status === "verification_failed");
    },
  );

  return server;
}

export async function serveCapabilityMcpStdio(
  dependencies: CapabilityMcpServerDependencies,
): Promise<void> {
  const server = createCapabilityMcpServer(dependencies);
  await server.connect(new StdioServerTransport());
}

function toMcpResult(payload: unknown, isError = false): {
  readonly content: { readonly type: "text"; readonly text: string }[];
  readonly isError?: true;
} {
  return {
    content: [{
      type: "text",
      text: JSON.stringify(payload) ?? "null",
    }],
    ...(isError ? { isError: true } : {}),
  };
}

function toPublicResolution(resolution: CapabilityResolution): unknown {
  if (resolution.status === "ambiguous" || resolution.status === "not_found") {
    return resolution;
  }

  return {
    status: resolution.status,
    score: resolution.score,
    capability: toPublicDescriptor(resolution.descriptor),
    ...(resolution.status === "procedure_available"
      ? { procedure: resolution.procedure }
      : {}),
  };
}

function toPublicDescriptor(descriptor: CapabilityDescriptor): Omit<CapabilityDescriptor, "verification"> {
  const {
    verification: _verification,
    ...publicDescriptor
  } = descriptor;
  return publicDescriptor;
}

function toJsonObject(value: Record<string, unknown>): JsonObject {
  if (!isJsonObject(value)) {
    throw new Error("Capability arguments must be a JSON object.");
  }
  return value;
}

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    && isJsonRecord(value as Record<string, unknown>);
}

function isJsonRecord(value: Record<string, unknown>): boolean {
  return Object.values(value).every(isJsonValue);
}

function isJsonValue(value: unknown): value is JsonValue {
  if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return true;
  }
  if (Array.isArray(value)) {
    return value.every(isJsonValue);
  }
  return typeof value === "object" && value !== null && !Array.isArray(value) && isJsonRecord(value as Record<string, unknown>);
}

export type { McpServer };
