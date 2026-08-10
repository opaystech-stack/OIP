import { OdooJsonRpcClient, type OdooJsonRpcConfig } from "../src/odoo-jsonrpc.js";

const SERVICE_LOGIN = "oip-system-agent@opays.io";
const SERVICE_NAME = "OIP System Agent";
const DATABASE = process.env.ODOO_DB ?? "opays_hq";
const URL = required("ODOO_URL");
const adminConfig: OdooJsonRpcConfig = {
  baseUrl: URL,
  database: DATABASE,
  username: required("ODOO_ADMIN_USER"),
  password: required("ODOO_ADMIN_PASSWORD"),
};
const servicePassword = required("OIP_ODOO_SERVICE_PASSWORD");

const admin = new OdooJsonRpcClient(adminConfig);
const adminUid = await admin.authenticate();
const serviceGroupId = await ensureServiceGroup(admin);

const modelIds = await resolveModels(admin, [
  "res.partner",
  "crm.lead",
  "project.project",
  "project.task",
  "account.move",
  "hr.employee",
]);
await ensureAccessRules(admin, serviceGroupId, modelIds);

const existing = await searchOne(admin, "res.users", [["login", "=", SERVICE_LOGIN]], ["id"]);
const userValues = {
  name: SERVICE_NAME,
  login: SERVICE_LOGIN,
  email: SERVICE_LOGIN,
  password: servicePassword,
  active: true,
  share: false,
  group_ids: [[6, 0, [serviceGroupId]]],
};
const serviceUid = existing === undefined
  ? await createUser(admin, userValues)
  : await updateUser(admin, existing.id, userValues);

const serviceClient = new OdooJsonRpcClient({
  baseUrl: URL,
  database: DATABASE,
  username: SERVICE_LOGIN,
  password: servicePassword,
});
await serviceClient.authenticate();
const access = await readAccessMatrix(serviceClient);
const user = await searchOne(serviceClient, "res.users", [["id", "=", serviceUid]], ["login", "active", "share", "group_ids"]);

if (!access["res.partner.read"] || !access["project.project.read"] || !access["project.task.read"] || !access["account.move.read"] || !access["hr.employee.read"] || !access["crm.lead.create"] || access["res.partner.write"] || access["project.task.write"] || access["account.move.write"] || access["hr.employee.write"]) {
  throw new Error("The service-user access matrix does not satisfy the least-privilege gate.");
}

console.log(JSON.stringify({
  status: existing === undefined ? "created" : "updated",
  adminUid,
  serviceUid,
  login: SERVICE_LOGIN,
  database: DATABASE,
  groupIds: [serviceGroupId],
  user: user ? { login: user.login, active: user.active, share: user.share } : undefined,
  access,
  secret: "stored by caller only; value not printed",
}));

async function ensureServiceGroup(client: OdooJsonRpcClient): Promise<number> {
  const found = await searchOne(client, "res.groups", [["name", "=", SERVICE_NAME]], ["id"]);
  if (found?.id !== undefined) return found.id;
  const created = await client.executeKw("res.groups", "create", [{ name: SERVICE_NAME, comment: "Least-privilege OIP to Odoo integration group." }]);
  return requireNumber(created, "service group id");
}

async function ensureAccessRules(client: OdooJsonRpcClient, groupId: number, models: Readonly<Record<string, number>>): Promise<void> {
  const rules: readonly { model: string; read: boolean; create: boolean }[] = [
    { model: "res.partner", read: true, create: false },
    { model: "crm.lead", read: true, create: true },
    { model: "project.project", read: true, create: false },
    { model: "project.task", read: true, create: false },
    { model: "account.move", read: true, create: false },
    { model: "hr.employee", read: true, create: false },
  ];

  for (const rule of rules) {
    const name = `OIP System Agent — ${rule.model}`;
    const existing = await searchOne(client, "ir.model.access", [["name", "=", name], ["group_id", "=", groupId]], ["id"]);
    const values = {
      name,
      model_id: models[rule.model],
      group_id: groupId,
      perm_read: rule.read,
      perm_create: rule.create,
      perm_write: false,
      perm_unlink: false,
    };
    if (existing?.id !== undefined) {
      await client.executeKw("ir.model.access", "write", [[existing.id], values]);
    } else {
      await client.executeKw("ir.model.access", "create", [values]);
    }
  }
}

async function resolveModels(client: OdooJsonRpcClient, names: readonly string[]): Promise<Readonly<Record<string, number>>> {
  const result: Record<string, number> = {};
  for (const name of names) {
    const row = await searchOne(client, "ir.model", [["model", "=", name]], ["id"]);
    if (!row?.id) throw new Error(`Odoo model is not installed: ${name}`);
    result[name] = row.id;
  }
  return result;
}

async function createUser(client: OdooJsonRpcClient, values: Record<string, unknown>): Promise<number> {
  const result = await client.executeKw("res.users", "create", [values]);
  return requireNumber(result, "service user id");
}

async function updateUser(client: OdooJsonRpcClient, id: number, values: Record<string, unknown>): Promise<number> {
  await client.executeKw("res.users", "write", [[id], values]);
  return id;
}

async function readAccessMatrix(client: OdooJsonRpcClient): Promise<Record<string, boolean>> {
  const models = ["res.partner", "crm.lead", "project.project", "project.task", "account.move", "hr.employee"];
  const operations = ["read", "create", "write", "unlink"];
  const matrix: Record<string, boolean> = {};
  for (const model of models) {
    for (const operation of operations) {
      const result = await client.executeKw(model, "check_access_rights", [operation], { raise_exception: false });
      matrix[`${model}.${operation}`] = result === true;
    }
  }
  return matrix;
}

async function searchOne(
  client: OdooJsonRpcClient,
  model: string,
  domain: readonly unknown[],
  fields: readonly string[],
): Promise<Record<string, any> | undefined> {
  const rows = await client.executeKw(model, "search_read", [domain], {
    fields: fields as unknown as import("../../../packages/core/src/contracts/common.js").JsonValue,
    limit: 1,
  });
  if (!Array.isArray(rows) || rows.length === 0) return undefined;
  const row = rows[0];
  if (typeof row !== "object" || row === null || Array.isArray(row)) throw new Error(`Invalid ${model} response.`);
  return row as Record<string, any>;
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function requireNumber(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) throw new Error(`Invalid ${label}.`);
  return value;
}
