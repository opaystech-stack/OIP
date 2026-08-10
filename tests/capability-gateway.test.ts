import { strict as assert } from "node:assert";
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
import { OipRuntime } from "../packages/runtime/src/index.js";
import {
  CapabilityDescriptor,
  CapabilityGateway,
} from "../packages/capability-gateway/src/index.js";

const capabilityId = "finance.supplier.debts.read";

async function run(): Promise<void> {
  const calls: ExecutionContext[] = [];
  const capabilities = new CapabilityRegistry();
  const tools = new ToolRegistry();
  const policy = new InMemoryPolicyRuntime();
  const events: EventPublisher = { publish: async () => undefined };
  const audit: AuditLogger = { record: async () => undefined };

  const descriptor: CapabilityDescriptor = {
    id: capabilityId,
    description: "Lire les dettes fournisseurs échues du tenant.",
    keywords: ["lire", "dettes", "fournisseurs", "échues", "comptabilité"],
    aliases: ["dettes fournisseurs"],
    parameters: [],
    requiredRoles: ["accounting.read"],
    confirmationLevel: "none",
    sideEffects: [],
    emits: [],
    source: "odoo",
    availability: "available",
    tenantScope: { organizationIds: ["org-1"] },
    verification: async (result, context) => ({
      verified:
        result.status === "completed" &&
        result.data?.organizationId === context.identity.organizationId &&
        Array.isArray(result.data?.debts),
      summary: "La réponse Odoo contient les dettes du tenant demandé.",
      evidence: {
        organizationId: context.identity.organizationId,
        resultContainsDebts: Array.isArray(result.data?.debts),
      },
    }),
  };

  capabilities.register(descriptor);
  tools.register(capabilityId, {
    execute: async (_args, context) => {
      calls.push({
        requestId: context.requestId,
        identity: {
          userId: context.user.userId,
          organizationId: context.user.organizationId,
          roles: context.user.roles,
        },
        channel: context.channel,
      });
      return success(capabilityId, {
        organizationId: context.user.organizationId,
        debts: ["supplier-1"],
      });
    },
  });
  await policy.registerPolicy({
    id: `policy:${capabilityId}`,
    description: "La lecture des dettes est réservée à la comptabilité.",
    resource: capabilityId,
    action: "execute",
    rules: [{ rolesAll: ["accounting.read"] }],
  });

  const action = new ActionEngineRuntime(capabilities, tools, events, audit);
  const gateway = new CapabilityGateway({
    descriptors: [descriptor],
    action,
    policy,
  });

  const result = await gateway.invoke(
    {
      query: "Lis les dettes fournisseurs échues de mon magasin",
      arguments: {},
    },
    {
      requestId: "debt-read-1",
      identity: {
        userId: "accountant-1",
        organizationId: "org-1",
        roles: ["accounting.read"],
        locale: "fr",
      },
      channel: "api",
    },
  );

  assert.equal(result.status, "completed");
  assert.equal(result.capabilityId, capabilityId);
  assert.equal(result.result?.data?.organizationId, "org-1");
  assert.equal(result.evidence?.verified, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.identity.organizationId, "org-1");

  const procedureDescriptor: CapabilityDescriptor = {
    ...descriptor,
    id: "finance.supplier.debts.read.unconfigured",
    availability: "needs_setup",
    setupProcedure: {
      id: "setup.odoo.supplier-debts",
      type: "setup",
      title: "Brancher la lecture des dettes Odoo",
      summary: "La capacité existe mais son connecteur Odoo n'est pas configuré.",
      steps: [
        "Déclarer l'endpoint Odoo de lecture des dettes fournisseurs.",
        "Accorder le rôle comptable au connecteur du tenant.",
        "Tester une lecture en environnement de démonstration.",
        "Enregistrer la capacité après validation du test.",
      ],
    },
  };
  const procedureGateway = new CapabilityGateway({
    descriptors: [procedureDescriptor],
    action,
    policy,
  });
  const procedure = await procedureGateway.invoke(
    { query: "Lis les dettes fournisseurs", arguments: {} },
    {
      requestId: "debt-read-setup",
      identity: { userId: "accountant-1", organizationId: "org-1", roles: ["accounting.read"] },
      channel: "api",
    },
  );
  assert.equal(procedure.status, "procedure_available");
  assert.equal(procedure.procedure?.steps.length, 4);
  assert.equal(calls.length, 1);

  const ambiguousGateway = new CapabilityGateway({
    descriptors: [
      { ...descriptor, id: "finance.supplier.debts.read.a", keywords: ["same"] },
      { ...descriptor, id: "finance.supplier.debts.read.b", keywords: ["same"] },
    ],
    action,
    policy,
  });
  const ambiguous = await ambiguousGateway.invoke(
    { query: "same", arguments: {} },
    {
      requestId: "debt-read-ambiguous",
      identity: { userId: "accountant-1", organizationId: "org-1", roles: ["accounting.read"] },
      channel: "api",
    },
  );
  assert.equal(ambiguous.status, "ambiguous");
  assert.equal(ambiguous.candidates?.length, 2);

  const unsupported = await gateway.invoke(
    { query: "Réconcilie les factures d'un fournisseur inconnu", arguments: {} },
    {
      requestId: "debt-read-unsupported",
      identity: { userId: "accountant-1", organizationId: "org-1", roles: ["accounting.read"] },
      channel: "api",
    },
  );
  assert.equal(unsupported.status, "unsupported");
  assert.equal(calls.length, 1);

  const tenantDenied = await gateway.invoke(
    { capabilityId, arguments: {} },
    {
      requestId: "debt-read-tenant-denied",
      identity: { userId: "accountant-2", organizationId: "org-2", roles: ["accounting.read"] },
      channel: "api",
    },
  );
  assert.equal(tenantDenied.status, "rejected");
  assert.equal(tenantDenied.message, "The capability is not available for this tenant.");
  assert.equal(calls.length, 1);

  const policyDenied = await gateway.invoke(
    { capabilityId, arguments: {} },
    {
      requestId: "debt-read-policy-denied",
      identity: { userId: "viewer-1", organizationId: "org-1", roles: [] },
      channel: "api",
    },
  );
  assert.equal(policyDenied.status, "rejected");
  assert.equal(calls.length, 1);

  const unverifiedId = "finance.supplier.debts.read.unverified";
  const unverifiedDescriptor: CapabilityDescriptor = {
    ...descriptor,
    id: unverifiedId,
    keywords: ["dettes", "non vérifiées"],
    verification: async () => ({
      verified: false,
      summary: "La réponse n'est pas rattachée au tenant demandé.",
      evidence: { tenantMatch: false },
    }),
  };
  capabilities.register(unverifiedDescriptor);
  tools.register(unverifiedId, {
    execute: async () => success(unverifiedId, { debts: ["unknown-source"] }),
  });
  await policy.registerPolicy({
    id: `policy:${unverifiedId}`,
    description: "Test de vérification négative.",
    resource: unverifiedId,
    action: "execute",
    rules: [{ rolesAll: ["accounting.read"] }],
  });
  const unverified = new CapabilityGateway({
    descriptors: [unverifiedDescriptor],
    action,
    policy,
  });
  const verificationFailed = await unverified.invoke(
    { capabilityId: unverifiedId, arguments: {} },
    {
      requestId: "debt-read-unverified",
      identity: { userId: "accountant-1", organizationId: "org-1", roles: ["accounting.read"] },
      channel: "api",
    },
  );
  assert.equal(verificationFailed.status, "verification_failed");
  assert.equal(verificationFailed.result?.status, "completed");
  assert.equal(verificationFailed.evidence?.verified, false);

  const confirmationId = "finance.supplier.debts.export";
  const confirmationDescriptor: CapabilityDescriptor = {
    ...descriptor,
    id: confirmationId,
    keywords: ["exporter", "dettes"],
  };
  capabilities.register(confirmationDescriptor);
  tools.register(confirmationId, {
    execute: async () => success(confirmationId, { exported: true }),
  });
  await policy.registerPolicy({
    id: `policy:${confirmationId}`,
    description: "Export de dettes soumis à confirmation.",
    resource: confirmationId,
    action: "execute",
    rules: [{ rolesAll: ["accounting.read"], confirmationLevel: "high" }],
  });
  const confirmationGateway = new CapabilityGateway({
    descriptors: [confirmationDescriptor],
    action,
    policy,
  });
  const confirmation = await confirmationGateway.invoke(
    { capabilityId: confirmationId, arguments: {} },
    {
      requestId: "debt-export-confirmation",
      identity: { userId: "accountant-1", organizationId: "org-1", roles: ["accounting.read"] },
      channel: "api",
    },
  );
  assert.equal(confirmation.status, "confirmation_required");

  const integratedRuntime = new OipRuntime();
  await integratedRuntime.registerCapability(descriptor, {
    execute: async (_args, context) => success(capabilityId, {
      organizationId: context.user.organizationId,
      debts: ["supplier-2"],
    }),
  });
  assert.equal(integratedRuntime.capabilityGateway.listTools().length, 1);
  const integrated = await integratedRuntime.capabilityGateway.invoke(
    { capabilityId, arguments: {} },
    {
      requestId: "debt-read-runtime",
      identity: { userId: "accountant-1", organizationId: "org-1", roles: ["accounting.read"] },
      channel: "api",
    },
  );
  assert.equal(integrated.status, "completed");
  const integratedAudit = (integratedRuntime.audit.list?.() as readonly {
    readonly metadata?: { readonly outcome?: unknown };
  }[] | undefined) ?? [];
  assert.equal(integratedAudit.some((record) => record.metadata?.outcome === "completed"), true);

  console.log("ok - capability gateway resolves, governs, executes and verifies a tenant-scoped capability");
}

void run();
