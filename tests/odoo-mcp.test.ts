import assert from "node:assert/strict";
import { createOdooGateway } from "../services/odoo-mcp/src/capabilities.js";
import type { OdooExecutor } from "../services/odoo-mcp/src/odoo-jsonrpc.js";
import type { JsonObject } from "../packages/core/src/contracts/common.js";
import type { GoogleWorkspaceExecutor, GoogleWorkspaceCapabilityId } from "../services/odoo-mcp/src/google-workspace.js";

class FakeOdoo implements OdooExecutor {
  calls: Array<{ model: string; method: string; args: readonly unknown[]; kwargs?: JsonObject }> = [];

  async executeKw(
    model: string,
    method: string,
    args: readonly unknown[],
    kwargs: JsonObject = {},
  ): Promise<unknown> {
    this.calls.push({ model, method, args, kwargs });
    if (method === "search_read") {
      if (model === "res.partner") return [{ id: 1, name: "Acme", email: "contact@acme.test" }];
      if (model === "project.project") return [{ id: 2, name: "HQ", active: true }];
      if (model === "project.task") return [{ id: 3, name: "Prepare OIP", project_id: [2, "HQ"] }];
      if (model === "discuss.channel") return [{ id: 7, name: "Opays Team", channel_type: "channel", uuid: "channel-7", active: true }];
      if (model === "mail.message") return [{ id: 9, channel_id: [7, "Opays Team"], body: "Hello", message_type: "comment", date: "2026-08-11 07:00:00" }];
      if (model === "account.move") return [{ id: 4, name: "INV/2026/001", amount_residual: 120 }];
      if (model === "hr.employee") return [{ id: 5, name: "Employee", active: true }];
      if (model === "crm.lead") return [{ id: 6, name: "Validated lead", type: "lead" }];
    }
    if (model === "discuss.channel" && method === "message_post") return 9;
    if (model === "crm.lead" && method === "create") return 6;
    throw new Error(`Unexpected fake call: ${model}.${method}`);
  }
}

class FakeGoogle implements GoogleWorkspaceExecutor {
  calls: Array<{ capabilityId: GoogleWorkspaceCapabilityId; args: JsonObject }> = [];

  async execute(capabilityId: GoogleWorkspaceCapabilityId, args: JsonObject): Promise<JsonObject> {
    this.calls.push({ capabilityId, args });
    return { status: "fake-google-result" };
  }
}

const fake = new FakeOdoo();
const bundle = createOdooGateway({
  client: fake,
  serviceUid: 8,
  database: "opays_hq",
  organizationId: "opays_hq",
  roles: ["oip.service"],
});
const ids = bundle.descriptors.map((descriptor) => descriptor.id);
assert.deepEqual(ids, [
  "odoo.contacts.search",
  "odoo.crm.leads.create",
  "odoo.projects.tasks.read",
  "odoo.discuss.channels.read",
  "odoo.discuss.messages.read",
  "odoo.discuss.message.post",
  "google.calendar.event.create",
  "google.calendar.events.read",
  "google.gmail.send",
  "google.gmail.read",
  "google.drive.docs.read",
  "google.sheets.update",
  "odoo.accounting.debts.read",
  "odoo.hr.employees.read",
]);

const context = await bundle.contextFactory({
  operation: "invoke",
  requestId: "test-request",
  arguments: {},
});
assert.equal(context.identity.userId, "8");
assert.equal(context.identity.organizationId, "opays_hq");
assert.deepEqual(context.identity.roles, ["oip.service"]);

const contacts = await bundle.gateway.invoke({
  capabilityId: "odoo.contacts.search",
  arguments: { query: "Acme", limit: 5 },
}, context);
assert.equal(contacts.status, "completed");
assert.equal(contacts.evidence?.verified, true);
assert.equal((contacts.result?.data as JsonObject).recordCount, 1);

const projects = await bundle.gateway.invoke({
  capabilityId: "odoo.projects.tasks.read",
  arguments: { projectId: 2 },
}, context);
assert.equal(projects.status, "completed");
assert.equal(projects.evidence?.verified, true);
const taskRead = fake.calls.find((call) => call.model === "project.task" && call.method === "search_read");
assert.ok(taskRead);
assert.equal((taskRead.kwargs?.fields as readonly string[]).includes("user_ids"), false);

const channels = await bundle.gateway.invoke({
  capabilityId: "odoo.discuss.channels.read",
  arguments: { query: "Opays", limit: 5 },
}, context);
assert.equal(channels.status, "completed");
assert.equal(channels.evidence?.verified, true);
assert.equal((channels.result?.data as JsonObject).recordCount, 1);

const messages = await bundle.gateway.invoke({
  capabilityId: "odoo.discuss.messages.read",
  arguments: { channelId: 7, limit: 5 },
}, context);
assert.equal(messages.status, "completed");
assert.equal(messages.evidence?.verified, true);
const messageRead = fake.calls.find((call) => call.model === "mail.message" && call.method === "search_read");
assert.ok(messageRead);
assert.deepEqual(messageRead.args[0], [["model", "=", "discuss.channel"], ["res_id", "=", 7]]);

const callsBeforeDiscussPost = fake.calls.length;
const post = await bundle.gateway.invoke({
  capabilityId: "odoo.discuss.message.post",
  arguments: { channelId: 7, body: "A governed reply" },
}, context);
assert.equal(post.status, "confirmation_required");
assert.equal(fake.calls.length, callsBeforeDiscussPost);

const debts = await bundle.gateway.invoke({
  capabilityId: "odoo.accounting.debts.read",
  arguments: {},
}, context);
assert.equal(debts.status, "completed");
assert.equal(debts.evidence?.verified, true);

const employees = await bundle.gateway.invoke({
  capabilityId: "odoo.hr.employees.read",
  arguments: {},
}, context);
assert.equal(employees.status, "completed");
assert.equal(employees.evidence?.verified, true);

const googleEventsWithoutSetup = await bundle.gateway.invoke({
  capabilityId: "google.calendar.events.read",
  arguments: { maxResults: 1 },
}, context);
assert.equal(bundle.descriptors.find((descriptor) => descriptor.id === "google.calendar.events.read")?.availability, "needs_setup");
assert.equal(googleEventsWithoutSetup.status, "procedure_available");
assert.equal(googleEventsWithoutSetup.procedure?.id, "google.workspace.oauth2.setup");

const fakeGoogle = new FakeGoogle();
const configuredBundle = createOdooGateway({
  client: fake,
  serviceUid: 8,
  database: "opays_hq",
  organizationId: "opays_hq",
  roles: ["oip.service"],
  googleWorkspace: fakeGoogle,
});
const googleEvents = await configuredBundle.gateway.invoke({
  capabilityId: "google.calendar.events.read",
  arguments: { maxResults: 1 },
}, context);
assert.equal(googleEvents.status, "completed");
assert.equal(googleEvents.evidence?.verified, true);
assert.equal(fakeGoogle.calls.length, 1);

const googleCallsBeforeSend = fakeGoogle.calls.length;
const googleSend = await configuredBundle.gateway.invoke({
  capabilityId: "google.gmail.send",
  arguments: { to: "customer@example.test", subject: "Policy test", body: "No send" },
}, context);
assert.equal(googleSend.status, "confirmation_required");
assert.equal(fakeGoogle.calls.length, googleCallsBeforeSend);

const googleCallsBeforeSheet = fakeGoogle.calls.length;
const googleSheet = await configuredBundle.gateway.invoke({
  capabilityId: "google.sheets.update",
  arguments: { spreadsheetId: "sheet-test", range: "Sheet1!A1", values: [["No write"]] },
}, context);
assert.equal(googleSheet.status, "confirmation_required");
assert.equal(fakeGoogle.calls.length, googleCallsBeforeSheet);

const callsBeforeCreate = fake.calls.length;
const create = await bundle.gateway.invoke({
  capabilityId: "odoo.crm.leads.create",
  arguments: { name: "A governed lead" },
}, context);
assert.equal(create.status, "confirmation_required");
assert.equal(fake.calls.length, callsBeforeCreate);

const callsBeforeReserved = fake.calls.length;
const reserved = await bundle.gateway.invoke({
  capabilityId: "odoo.contacts.search",
  arguments: { organizationId: "other-tenant" },
}, context);
assert.equal(reserved.status, "rejected");
assert.equal(fake.calls.length, callsBeforeReserved);

const callsBeforeCrossTenant = fake.calls.length;
const crossTenant = await bundle.gateway.invoke({
  capabilityId: "odoo.contacts.search",
  arguments: {},
}, {
  ...context,
  identity: { ...context.identity, organizationId: "other-tenant" },
});
assert.equal(crossTenant.status, "rejected");
assert.equal(fake.calls.length, callsBeforeCrossTenant);

console.log(JSON.stringify({
  test: "odoo-mcp-gateway",
  status: "passed",
  descriptors: ids,
  readCapabilitiesVerified: 4,
  crmWrite: "confirmation_required_without_side_effect",
  crossTenant: "rejected_without_odoo_call",
}));
