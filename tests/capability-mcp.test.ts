import { strict as assert } from "node:assert";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { ActionEngineRuntime } from "../packages/action-runtime/src/index.js";
import { InMemoryPolicyRuntime } from "../packages/policy-runtime/src/index.js";
import {
  AuditLogger,
  CapabilityRegistry,
  EventPublisher,
  ToolRegistry,
  success,
} from "../packages/core/src/index.js";
import type { ExecutionContext } from "../packages/core/src/contracts/index.js";
import {
  CapabilityGateway,
  type CapabilityDescriptor,
} from "../packages/capability-gateway/src/index.js";
import { createCapabilityMcpServer } from "../packages/capability-gateway/src/mcp.js";

const capabilityId = "finance.supplier.debts.read.mcp";

async function run(): Promise<void> {
  const capabilities = new CapabilityRegistry();
  const tools = new ToolRegistry();
  const policy = new InMemoryPolicyRuntime();
  const events: EventPublisher = { publish: async () => undefined };
  const audit: AuditLogger = { record: async () => undefined };
  const descriptor: CapabilityDescriptor = {
    id: capabilityId,
    description: "Lire les dettes fournisseurs.",
    keywords: ["dettes", "fournisseurs", "lire"],
    aliases: ["dettes fournisseur"],
    parameters: [],
    requiredRoles: ["accounting.read"],
    confirmationLevel: "none",
    sideEffects: [],
    emits: [],
    source: "odoo",
    availability: "available",
    tenantScope: { organizationIds: ["org-1"] },
    verification: async (result, context) => ({
      verified: result.data?.organizationId === context.identity.organizationId,
      summary: "Lecture vérifiée.",
      evidence: { organizationId: context.identity.organizationId },
    }),
  };
  capabilities.register(descriptor);
  tools.register(capabilityId, {
    execute: async (_args, context) => success(capabilityId, {
      organizationId: context.user.organizationId,
      debts: ["supplier-1"],
    }),
  });
  await policy.registerPolicy({
    id: `policy:${capabilityId}`,
    description: "Lecture comptable.",
    resource: capabilityId,
    action: "execute",
    rules: [{ rolesAll: ["accounting.read"] }],
  });

  const gateway = new CapabilityGateway({
    descriptors: [descriptor],
    action: new ActionEngineRuntime(capabilities, tools, events, audit),
    policy,
  });
  const server = createCapabilityMcpServer({
    gateway,
    context: async (input): Promise<ExecutionContext> => ({
      requestId: input.requestId,
      identity: {
        userId: "accountant-1",
        organizationId: "org-1",
        roles: ["accounting.read"],
        locale: "fr",
      },
      channel: "api",
    }),
  });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "oip-mcp-test-client", version: "1.0.0" });

  await server.connect(serverTransport);
  await client.connect(clientTransport);

  const toolsResult = await client.listTools();
  const toolNames = toolsResult.tools.map((tool) => tool.name).sort();
  assert.deepEqual(toolNames, ["oip_capability_invoke", "oip_capability_search"]);

  const searchResult = await client.callTool({
    name: "oip_capability_search",
    arguments: { query: "Lis les dettes fournisseurs" },
  });
  const searchPayload = parseTextResult(searchResult);
  assert.equal(searchPayload.status, "executable");

  const invokeResult = await client.callTool({
    name: "oip_capability_invoke",
    arguments: { capabilityId, arguments: {} },
  });
  const invokePayload = parseTextResult(invokeResult);
  assert.equal(invokePayload.status, "completed");
  assert.equal(invokePayload.capabilityId, capabilityId);

  await client.close();
  await server.close();
  console.log("ok - official MCP transport exposes search then governed capability invocation");
}

function parseTextResult(result: unknown): Record<string, unknown> {
  if (typeof result !== "object" || result === null || !("content" in result) || !Array.isArray(result.content)) {
    throw new Error("MCP result did not contain content.");
  }
  const content = result.content[0];
  if (typeof content !== "object" || content === null || !("type" in content) || content.type !== "text"
    || !("text" in content) || typeof content.text !== "string") {
    throw new Error("MCP result did not contain a text payload.");
  }
  return JSON.parse(content.text) as Record<string, unknown>;
}

void run();
