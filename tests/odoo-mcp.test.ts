import assert from "node:assert/strict";
import { createOdooGateway } from "../services/odoo-mcp/src/capabilities.js";
import type { OdooExecutor } from "../services/odoo-mcp/src/odoo-jsonrpc.js";
import type { JsonObject } from "../packages/core/src/contracts/common.js";

class FakeOdoo implements OdooExecutor {
  calls: Array<{ model: string; method: string }> = [];

  async executeKw(model: string, method: string, args: readonly unknown[]): Promise<unknown> {
    this.calls.push({ model, method });
    if (method === "search_read") {
      if (model === "res.partner") return [{ id: 1, name: "Acme", email: "contact@acme.test" }];
      if (model === "project.project") return [{ id: 2, name: "HQ", active: true }];
      if (model === "project.task") return [{ id: 3, name: "Prepare OIP", project_id: [2, "HQ"] }];
      if (model === "account.move") return [{ id: 4, name: "INV/2026/001", amount_residual: 120 }];
      if (model === "hr.employee") return [{ id: 5, name: "Employee", active: true }];
      if (model === "crm.lead") return [{ id: 6, name: "Validated lead", type: "lead" }];
      if (model === "sale.order") return [{ id: 7, name: "S00123", state: "sale", amount_total: 450 }];
    }
    if (model === "crm.lead" && method === "create") return 6;
    throw new Error(`Unexpected fake call: ${model}.${method}`);
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
  "odoo.accounting.debts.read",
  "odoo.hr.employees.read",
  "odoo.crm.leads.read",
  "odoo.sales.orders.read",
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

const leads = await bundle.gateway.invoke({
  capabilityId: "odoo.crm.leads.read",
  arguments: { query: "acme", limit: 10 },
}, context);
assert.equal(leads.status, "completed");
assert.equal(leads.evidence?.verified, true);
assert.equal((leads.result?.data as JsonObject).recordCount, 1);

const leadsWonExcluded = await bundle.gateway.invoke({
  capabilityId: "odoo.crm.leads.read",
  arguments: { includeWon: true },
}, context);
assert.equal(leadsWonExcluded.status, "completed");

const salesOrders = await bundle.gateway.invoke({
  capabilityId: "odoo.sales.orders.read",
  arguments: {},
}, context);
assert.equal(salesOrders.status, "completed");
assert.equal(salesOrders.evidence?.verified, true);
assert.equal((salesOrders.result?.data as JsonObject).recordCount, 1);

const salesInvalidState = await bundle.gateway.invoke({
  capabilityId: "odoo.sales.orders.read",
  arguments: { state: "bogus_state" },
}, context);
assert.equal(salesInvalidState.status, "rejected");

const leadsUnknownArg = await bundle.gateway.invoke({
  capabilityId: "odoo.crm.leads.read",
  arguments: { stageName: "nope" },
}, context);
assert.equal(leadsUnknownArg.status, "rejected");

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
  readCapabilitiesVerified: 6,
  crmWrite: "confirmation_required_without_side_effect",
  crossTenant: "rejected_without_odoo_call",
}));
