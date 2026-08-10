import { CapabilityGateway } from "@opaystech/oip/capability-gateway";
import type {
  CapabilityDescriptor,
  CapabilityGatewayAudit,
  CapabilityVerification,
} from "@opaystech/oip/capability-gateway";
import type {
  ActionResult,
  CapabilityDefinition,
  ExecutionContext,
  JsonObject,
  JsonValue,
  PlannedAction,
} from "@opaystech/oip";
import type { OdooMcpContextFactory } from "./mcp.js";
import { OdooJsonRpcError, type OdooExecutor, toJsonObject, toJsonValue } from "./odoo-jsonrpc.js";

export const OIP_RELEASE = "0.1.0-alpha.1";
export const OIP_ORGANIZATION_ID = "opays_hq";

export interface OdooGatewayOptions {
  readonly client: OdooExecutor;
  readonly serviceUid: number;
  readonly database: string;
  readonly organizationId?: string;
  readonly roles?: readonly string[];
  readonly requiredRole?: string;
  readonly audit?: CapabilityGatewayAudit;
}

export interface OdooGatewayBundle {
  readonly gateway: CapabilityGateway;
  readonly contextFactory: OdooMcpContextFactory;
  readonly descriptors: readonly CapabilityDescriptor[];
  readonly serviceUid: number;
  readonly organizationId: string;
}

type OdooHandler = (
  args: JsonObject,
  context: ExecutionContext,
) => Promise<ActionResult>;

interface OdooActionRuntime {
  execute(action: PlannedAction, context: ExecutionContext): Promise<ActionResult>;
}

interface OdooPolicyRequest {
  readonly subject: ExecutionContext["identity"];
  readonly resource: string;
  readonly action: string;
  readonly arguments?: JsonObject;
}

interface OdooPolicyDecision {
  readonly effect: "allow" | "deny" | "confirm";
  readonly reasons: readonly string[];
  readonly requiredConfirmationLevel?: "low" | "medium" | "high" | "critical";
}

interface OdooPolicyRuntimePort {
  evaluate(request: OdooPolicyRequest, context: ExecutionContext): Promise<OdooPolicyDecision>;
  registerPolicy(policy: unknown): Promise<void>;
}

export function createOdooGateway(options: OdooGatewayOptions): OdooGatewayBundle {
  const organizationId = options.organizationId ?? OIP_ORGANIZATION_ID;
  const requiredRole = options.requiredRole ?? "oip.service";
  const roles = Object.freeze([...(options.roles ?? [requiredRole])]);
  const descriptors = createOdooDescriptors(options.client, {
    database: options.database,
    organizationId,
    requiredRole,
  });
  const policy = createPolicies(descriptors, requiredRole);
  const action = createOdooActionRuntime(options.client, descriptors, {
    database: options.database,
    organizationId,
  });

  const gateway = new CapabilityGateway({
    action,
    policy,
    descriptors,
    ...(options.audit !== undefined ? { audit: options.audit } : {}),
  });

  const contextFactory: OdooMcpContextFactory = async ({ requestId }) => ({
    requestId,
    identity: {
      userId: String(options.serviceUid),
      organizationId,
      roles,
      locale: "fr",
      metadata: {
        contextSource: "odoo-mcp-server",
        oipRelease: OIP_RELEASE,
      },
    },
    channel: "api",
    locale: "fr",
    metadata: {
      contextSource: "odoo-mcp-server",
      oipRelease: OIP_RELEASE,
    },
  });

  return {
    gateway,
    contextFactory,
    descriptors,
    serviceUid: options.serviceUid,
    organizationId,
  };
}

export class JsonLineCapabilityAudit implements CapabilityGatewayAudit {
  async record(entry: Parameters<CapabilityGatewayAudit["record"]>[0]): Promise<void> {
    // Deliberately exclude request arguments, record data and all credential material.
    process.stdout.write(`${JSON.stringify({
      type: "oip_capability_audit",
      requestId: entry.requestId,
      organizationId: entry.organizationId,
      userId: entry.userId,
      capabilityId: entry.capabilityId,
      outcome: entry.outcome,
      reason: entry.reason,
      occurredAt: entry.occurredAt,
      metadata: entry.metadata,
    })}\n`);
  }
}

function createPolicies(
  descriptors: readonly CapabilityDescriptor[],
  requiredRole: string,
): OdooPolicyRuntimePort {
  return new OdooPolicyRuntime(descriptors, requiredRole);
}

function createOdooActionRuntime(
  client: OdooExecutor,
  descriptors: readonly CapabilityDescriptor[],
  options: { readonly database: string; readonly organizationId: string },
): OdooActionRuntime {
  const handlers = new Map<string, OdooHandler>([
    ["odoo.contacts.search", (args, context) => searchContacts(client, options, args, context)],
    ["odoo.crm.leads.create", (args, context) => createCrmLead(client, options, args, context)],
    ["odoo.projects.tasks.read", (args, context) => readProjectsAndTasks(client, options, args, context)],
    ["odoo.accounting.debts.read", (args, context) => readAccountingDebts(client, options, args, context)],
    ["odoo.hr.employees.read", (args, context) => readEmployees(client, options, args, context)],
  ]);
  const descriptorIds = new Set(descriptors.map((descriptor) => descriptor.id));

  return {
    async execute(action: PlannedAction, context: ExecutionContext): Promise<ActionResult> {
      if (!descriptorIds.has(action.capabilityId)) {
        return rejected(action.capabilityId, "capability_not_registered");
      }
      if (context.identity.organizationId !== options.organizationId) {
        return rejected(action.capabilityId, "tenant_scope_rejected");
      }

      const handler = handlers.get(action.capabilityId);
      if (!handler) return rejected(action.capabilityId, "capability_handler_missing");

      try {
        return await handler(action.arguments, context);
      } catch (error) {
        if (error instanceof OdooJsonRpcError) {
          return rejected(action.capabilityId, `odoo_${error.code}`);
        }
        return rejected(action.capabilityId, "odoo_execution_failed");
      }
    },
  };
}

class OdooPolicyRuntime implements OdooPolicyRuntimePort {
  private readonly descriptors: ReadonlyMap<string, CapabilityDescriptor>;

  constructor(
    descriptors: readonly CapabilityDescriptor[],
    private readonly requiredRole: string,
  ) {
    this.descriptors = new Map(descriptors.map((descriptor) => [descriptor.id, descriptor]));
  }

  async evaluate(request: OdooPolicyRequest, _context: ExecutionContext): Promise<OdooPolicyDecision> {
    const descriptor = this.descriptors.get(request.resource);
    if (descriptor === undefined || request.action !== "execute") {
      return { effect: "deny", reasons: ["The Odoo capability is not registered for execution."] };
    }
    if (!request.subject.roles.includes(this.requiredRole)) {
      return { effect: "deny", reasons: [`The required role ${this.requiredRole} is missing.`] };
    }
    if (descriptor.confirmationLevel === "none") {
      return { effect: "allow", reasons: [] };
    }
    return {
      effect: "confirm",
      reasons: [`Trusted confirmation is required for ${descriptor.id}.`],
      requiredConfirmationLevel: descriptor.confirmationLevel,
    };
  }

  async registerPolicy(_policy: unknown): Promise<void> {
    // The descriptors are the versioned policy source for this dedicated service.
  }
}

function createOdooDescriptors(
  client: OdooExecutor,
  options: { readonly database: string; readonly organizationId: string; readonly requiredRole: string },
): readonly CapabilityDescriptor[] {
  const verification = async (
    result: ActionResult,
    context: ExecutionContext,
  ) => verifyOdooResult(result, context, options.database);

  return [
    descriptor({
      id: "odoo.contacts.search",
      description: "Search and read Odoo contacts in the governed opays_hq tenant.",
      keywords: ["contacts", "contact", "partners", "res.partner", "clients", "recherche", "contacts"],
      aliases: ["find contacts", "search contacts", "rechercher des contacts"],
      parameters: [
        { name: "query", type: "string", required: false, description: "Name or email fragment." },
        { name: "limit", type: "number", required: false, description: "Maximum number of records, from 1 to 100." },
      ],
      requiredRoles: [options.requiredRole],
      confirmationLevel: "none",
      sideEffects: [],
      emits: [],
      verification,
    }),
    descriptor({
      id: "odoo.crm.leads.create",
      description: "Create a CRM lead in Odoo after trusted confirmation.",
      keywords: ["crm", "lead", "opportunity", "prospect", "create", "création", "piste"],
      aliases: ["create lead", "create opportunity", "créer une piste"],
      parameters: [
        { name: "name", type: "string", required: true, description: "Lead or opportunity name." },
        { name: "contactEmail", type: "string", required: false, description: "Contact email." },
        { name: "partnerId", type: "number", required: false, description: "Existing Odoo contact id." },
        { name: "description", type: "string", required: false, description: "Lead description." },
        { name: "expectedRevenue", type: "number", required: false, description: "Expected revenue." },
      ],
      requiredRoles: [options.requiredRole],
      confirmationLevel: "high",
      sideEffects: ["Creates one crm.lead record in opays_hq."],
      emits: ["odoo.crm.lead.created"],
      verification,
    }),
    descriptor({
      id: "odoo.projects.tasks.read",
      description: "Read Odoo projects and tasks in the governed opays_hq tenant.",
      keywords: ["projects", "project", "tasks", "task", "projets", "tâches", "planning"],
      aliases: ["read project tasks", "show project tasks", "afficher les tâches du projet"],
      parameters: [
        { name: "projectId", type: "number", required: false, description: "Optional Odoo project id." },
        { name: "limit", type: "number", required: false, description: "Maximum number of projects and tasks, from 1 to 100." },
      ],
      requiredRoles: [options.requiredRole],
      confirmationLevel: "none",
      sideEffects: [],
      emits: [],
      verification,
    }),
    descriptor({
      id: "odoo.accounting.debts.read",
      description: "Read posted unpaid customer and vendor invoices as governed Odoo debts.",
      keywords: ["accounting", "debts", "debt", "invoices", "unpaid", "comptabilité", "dettes", "factures"],
      aliases: ["read debts", "check debts", "vérifier les dettes"],
      parameters: [
        { name: "partnerId", type: "number", required: false, description: "Optional Odoo partner id." },
        { name: "limit", type: "number", required: false, description: "Maximum number of invoices, from 1 to 100." },
      ],
      requiredRoles: [options.requiredRole],
      confirmationLevel: "none",
      sideEffects: [],
      emits: [],
      verification,
    }),
    descriptor({
      id: "odoo.hr.employees.read",
      description: "Read active Odoo employees in the governed opays_hq tenant.",
      keywords: ["hr", "human resources", "employees", "employee", "rh", "salariés", "employés"],
      aliases: ["read employees", "show employees", "lire les employés"],
      parameters: [
        { name: "query", type: "string", required: false, description: "Name or work email fragment." },
        { name: "limit", type: "number", required: false, description: "Maximum number of employees, from 1 to 100." },
      ],
      requiredRoles: [options.requiredRole],
      confirmationLevel: "none",
      sideEffects: [],
      emits: [],
      verification,
    }),
  ].map((item) => ({ ...item, source: "services/odoo-mcp" }));
}

function descriptor(
  definition: CapabilityDefinition & {
    readonly keywords: readonly string[];
    readonly aliases: readonly string[];
    readonly verification: CapabilityDescriptor["verification"];
  },
): Omit<CapabilityDescriptor, "source"> {
  return {
    ...definition,
    availability: "available",
    tenantScope: { organizationIds: [OIP_ORGANIZATION_ID] },
  };
}

async function searchContacts(
  client: OdooExecutor,
  options: { readonly database: string; readonly organizationId: string },
  args: JsonObject,
  context: ExecutionContext,
): Promise<ActionResult> {
  const validation = validateArguments(args, ["query", "limit"]);
  if (validation) return rejected("odoo.contacts.search", validation);

  const query = optionalString(args.query);
  const limit = boundedLimit(args.limit);
  const domain: unknown[] = query
    ? ["|", ["name", "ilike", query], ["email", "ilike", query]]
    : [];
  const records = await searchRead(client, "res.partner", domain, ["id", "name", "email", "phone", "company_type"], limit);
  return completed("odoo.contacts.search", collectionData(options, context, "res.partner", records));
}

async function createCrmLead(
  client: OdooExecutor,
  options: { readonly database: string; readonly organizationId: string },
  args: JsonObject,
  context: ExecutionContext,
): Promise<ActionResult> {
  const validation = validateArguments(args, ["name", "contactEmail", "partnerId", "description", "expectedRevenue"]);
  if (validation) return rejected("odoo.crm.leads.create", validation);

  const name = requiredString(args.name);
  const values: JsonObject = {
    name,
    type: "lead",
    ...(args.contactEmail !== undefined ? { email_from: requiredString(args.contactEmail) } : {}),
    ...(args.partnerId !== undefined ? { partner_id: requiredNumber(args.partnerId) } : {}),
    ...(args.description !== undefined ? { description: requiredString(args.description) } : {}),
    ...(args.expectedRevenue !== undefined ? { expected_revenue: requiredNumber(args.expectedRevenue) } : {}),
  };

  const created = await client.executeKw("crm.lead", "create", [values]);
  const recordId = typeof created === "number" ? created : undefined;
  if (recordId === undefined) return rejected("odoo.crm.leads.create", "create_result_invalid");

  const rows = await searchRead(client, "crm.lead", [["id", "=", recordId]], ["id", "name", "type", "email_from", "expected_revenue"], 1);
  if (rows.length !== 1) return rejected("odoo.crm.leads.create", "post_create_verification_failed");

  return completed("odoo.crm.leads.create", {
    ...collectionData(options, context, "crm.lead", rows),
    recordId,
    writeVerified: true,
  });
}

async function readProjectsAndTasks(
  client: OdooExecutor,
  options: { readonly database: string; readonly organizationId: string },
  args: JsonObject,
  context: ExecutionContext,
): Promise<ActionResult> {
  const validation = validateArguments(args, ["projectId", "limit"]);
  if (validation) return rejected("odoo.projects.tasks.read", validation);

  const projectId = args.projectId === undefined ? undefined : requiredNumber(args.projectId);
  const limit = boundedLimit(args.limit);
  const projectDomain: unknown[] = projectId === undefined ? [] : [["id", "=", projectId]];
  const taskDomain: unknown[] = projectId === undefined ? [] : [["project_id", "=", projectId]];
  const projects = await searchRead(client, "project.project", projectDomain, ["id", "name", "active"], limit);
  const tasks = await searchRead(client, "project.task", taskDomain, ["id", "name", "project_id", "stage_id", "user_ids", "active"], limit);

  return completed("odoo.projects.tasks.read", {
    ...baseData(options, context, "project.project,project.task"),
    projects: jsonRows(projects),
    tasks: jsonRows(tasks),
    projectCount: projects.length,
    taskCount: tasks.length,
  });
}

async function readAccountingDebts(
  client: OdooExecutor,
  options: { readonly database: string; readonly organizationId: string },
  args: JsonObject,
  context: ExecutionContext,
): Promise<ActionResult> {
  const validation = validateArguments(args, ["partnerId", "limit"]);
  if (validation) return rejected("odoo.accounting.debts.read", validation);

  const partnerId = args.partnerId === undefined ? undefined : requiredNumber(args.partnerId);
  const limit = boundedLimit(args.limit);
  const domain: unknown[] = [
    ["state", "=", "posted"],
    ["payment_state", "not in", ["paid", "reversed"]],
    ["amount_residual", "!=", 0],
    ["move_type", "in", ["out_invoice", "out_refund", "in_invoice", "in_refund"]],
  ];
  if (partnerId !== undefined) domain.push(["partner_id", "=", partnerId]);
  const records = await searchRead(
    client,
    "account.move",
    domain,
    ["id", "name", "partner_id", "invoice_date", "invoice_date_due", "amount_residual", "currency_id", "move_type", "payment_state"],
    limit,
  );
  return completed("odoo.accounting.debts.read", collectionData(options, context, "account.move", records));
}

async function readEmployees(
  client: OdooExecutor,
  options: { readonly database: string; readonly organizationId: string },
  args: JsonObject,
  context: ExecutionContext,
): Promise<ActionResult> {
  const validation = validateArguments(args, ["query", "limit"]);
  if (validation) return rejected("odoo.hr.employees.read", validation);

  const query = optionalString(args.query);
  const limit = boundedLimit(args.limit);
  const domain: unknown[] = [["active", "=", true]];
  if (query) domain.push("|", ["name", "ilike", query], ["work_email", "ilike", query]);
  const records = await searchRead(client, "hr.employee", domain, ["id", "name", "job_title", "department_id", "work_email", "active"], limit);
  return completed("odoo.hr.employees.read", collectionData(options, context, "hr.employee", records));
}

async function searchRead(
  client: OdooExecutor,
  model: string,
  domain: readonly unknown[],
  fields: readonly string[],
  limit: number,
): Promise<readonly JsonObject[]> {
  const payload = await client.executeKw(model, "search_read", [domain], {
    fields: fields as unknown as JsonValue,
    limit,
    order: "id asc",
  });
  if (!Array.isArray(payload)) throw new OdooJsonRpcError("Odoo search_read returned an invalid result.", "invalid_response");
  return payload.map(toJsonObject);
}

function baseData(
  options: { readonly database: string; readonly organizationId: string },
  context: ExecutionContext,
  model: string,
): JsonObject {
  return {
    source: "odoo.json-rpc",
    database: options.database,
    organizationId: context.identity.organizationId,
    model,
    tenantVerified: context.identity.organizationId === options.organizationId,
  };
}

function collectionData(
  options: { readonly database: string; readonly organizationId: string },
  context: ExecutionContext,
  model: string,
  records: readonly JsonObject[],
): JsonObject {
  return {
    ...baseData(options, context, model),
    records: jsonRows(records),
    recordCount: records.length,
  };
}

function jsonRows(rows: readonly JsonObject[]): JsonValue[] {
  return rows.map((row) => row as JsonValue);
}

function completed(capabilityId: string, data: JsonObject): ActionResult {
  return { capabilityId, status: "completed", data, events: [] };
}

function rejected(capabilityId: string, code: string): ActionResult {
  return {
    capabilityId,
    status: "rejected",
    data: {
      issues: [{ code, message: "The Odoo capability request was rejected." }],
    },
    events: [],
  };
}

function validateArguments(args: JsonObject, allowed: readonly string[]): string | undefined {
  const allowedSet = new Set(allowed);
  const reserved = new Set(["userId", "organizationId", "tenantId", "roles", "credentials", "password", "token", "oauth_uid"]);
  for (const key of Object.keys(args)) {
    if (reserved.has(key)) return "security_context_argument_forbidden";
    if (!allowedSet.has(key)) return "unknown_argument";
  }
  return undefined;
}

function optionalString(value: JsonValue | undefined): string | undefined {
  if (value === undefined) return undefined;
  return requiredString(value);
}

function requiredString(value: JsonValue | undefined): string {
  if (typeof value !== "string" || value.trim().length === 0) throw new Error("invalid_string");
  return value.trim();
}

function requiredNumber(value: JsonValue | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error("invalid_number");
  return value;
}

function boundedLimit(value: JsonValue | undefined): number {
  if (value === undefined) return 50;
  const limit = requiredNumber(value);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error("invalid_limit");
  return limit;
}

async function verifyOdooResult(
  result: ActionResult,
  context: ExecutionContext,
  database: string,
): Promise<CapabilityVerification> {
  const data = result.data;
  const verified = result.status === "completed"
    && data?.source === "odoo.json-rpc"
    && data.database === database
    && data.organizationId === context.identity.organizationId
    && data.tenantVerified === true;

  return {
    verified,
    summary: verified
      ? "Odoo returned a result verified against the server-derived tenant and database scope."
      : "The Odoo result could not be verified against the server-derived tenant and database scope.",
    evidence: {
      source: typeof data?.source === "string" ? data.source : "unknown",
      database: typeof data?.database === "string" ? data.database : "unknown",
      organizationId: context.identity.organizationId,
      recordCount: typeof data?.recordCount === "number" ? data.recordCount : 0,
      tenantVerified: data?.tenantVerified === true,
    },
  };
}
