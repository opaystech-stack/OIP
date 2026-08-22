import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { loadOdooMcpConfig, startOdooMcpServer } from "../services/odoo-mcp/src/server.js";
import type { OdooExecutor } from "../services/odoo-mcp/src/odoo-jsonrpc.js";

class FakeOdoo implements OdooExecutor {
  async executeKw(model: string, method: string): Promise<unknown> {
    if (model === "res.partner" && method === "search_read") {
      return [{ id: 1, name: "Acme", email: "contact@acme.test" }];
    }
    throw new Error(`Unexpected fake call: ${model}.${method}`);
  }
}

const stagedGoogleConfig = loadOdooMcpConfig({
  PORT: "3000",
  MCP_AUTH_TOKEN: "test-mcp-token",
  ODOO_URL: "http://fake-odoo.invalid",
  ODOO_USER: "unused",
  ODOO_PASSWORD: "unused",
  GOOGLE_CLIENT_ID: "staged-client-id",
  GOOGLE_CLIENT_SECRET: "staged-client-secret",
});
assert.equal("googleWorkspace" in stagedGoogleConfig, false);

const application = await startOdooMcpServer({
  port: 0,
  mcpAuthToken: "test-mcp-token",
  odooUrl: "http://fake-odoo.invalid",
  odooDatabase: "opays_hq",
  odooUsername: "unused",
  odooPassword: "unused",
  organizationId: "opays_hq",
  roles: ["oip.service"],
  requiredRole: "oip.service",
}, { executor: new FakeOdoo(), serviceUid: 8 });

try {
  const health = await fetch(`http://127.0.0.1:${application.port}/health`);
  assert.equal(health.status, 200);
  const healthBody = await health.json() as { status: string; service: string; oipRelease: string };
  assert.deepEqual(healthBody, {
    status: "ok",
    service: "odoo-mcp",
    oipRelease: "0.1.0-alpha.1",
  });

  const unauthorized = await fetch(`http://127.0.0.1:${application.port}/mcp`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} }),
  });
  assert.equal(unauthorized.status, 401);

  const client = new Client({ name: "odoo-mcp-http-test", version: "1.0.0" }, { capabilities: {} });
  const transport = new StreamableHTTPClientTransport(
    new URL(`http://127.0.0.1:${application.port}/mcp`),
    { requestInit: { headers: { Authorization: "Bearer test-mcp-token" } } },
  );

  await client.connect(transport as never);
  const tools = await client.listTools();
  assert.deepEqual(tools.tools.map((tool) => tool.name), ["oip_capability_search", "oip_capability_invoke"]);

  const result = await client.callTool({
    name: "oip_capability_invoke",
    arguments: {
      capabilityId: "odoo.contacts.search",
      arguments: { query: "Acme" },
    },
  });
  const content = result.content as readonly { readonly type: string; readonly text?: string }[];
  const text = content.find((item) => item.type === "text");
  if (!text || text.text === undefined) throw new Error("MCP response did not contain a text payload.");
  const payload = JSON.parse(text.text) as { status: string; capabilityId: string; evidence?: { verified: boolean } };
  assert.equal(payload.status, "completed");
  assert.equal(payload.capabilityId, "odoo.contacts.search");
  assert.equal(payload.evidence?.verified, true);
  await client.close();

  console.log(JSON.stringify({
    test: "odoo-mcp-http",
    status: "passed",
    health: 200,
    unauthorizedMcp: 401,
    mcpInitialize: "official StreamableHTTPClientTransport",
    tools: tools.tools.map((tool) => tool.name),
    invocation: "completed_and_verified",
  }));
} finally {
  await application.close();
}
