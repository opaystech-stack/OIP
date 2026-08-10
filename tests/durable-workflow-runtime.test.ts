import { strict as assert } from "node:assert";
import { InMemoryAuditLog } from "../packages/audit-log/src/index.js";
import { InMemoryEventRuntime } from "../packages/event-runtime/src/index.js";
import { InMemoryIdentityRuntime } from "../packages/identity-runtime/src/index.js";
import { InMemoryPolicyRuntime } from "../packages/policy-runtime/src/index.js";
import { DirectIntentInterpreter, OipRuntime } from "../packages/runtime/src/index.js";
import {
  DurableWorkflowRegistry,
  DurableWorkflowRuntime,
  InMemoryWorkflowExecutionStore,
} from "../packages/workflow-engine/src/index.js";

const registry = new DurableWorkflowRegistry();
registry.register(
  { id: "test.approval", pluginId: "test", description: "Approval workflow.", steps: [] },
  {
    start: async (_args, _context, execution) => ({ ...execution, status: "awaiting_input", steps: [{ stepId: "approval", status: "awaiting_input" }] }),
    resume: async (execution) => ({ ...execution, status: "completed", steps: [{ stepId: "approval", status: "completed" }] }),
    compensate: async (execution) => ({ ...execution, status: "compensated", steps: [{ stepId: "approval", status: "compensated" }] }),
    signal: async (execution, signal) => ({
      ...execution,
      status: signal.type === "approved" ? "completed" : "awaiting_input",
      steps: [{ stepId: "approval", status: signal.type === "approved" ? "completed" : "awaiting_input" }],
    }),
  },
);

const events = new InMemoryEventRuntime();
const observed: string[] = [];
await events.subscribe({}, (event) => { observed.push(event.type); });
const audit = new InMemoryAuditLog();
const runtime = new DurableWorkflowRuntime(registry, new InMemoryWorkflowExecutionStore(), events, audit);
const context = {
  requestId: "workflow-request",
  identity: { userId: "manager", organizationId: "org", roles: ["manager"] },
  channel: "api" as const,
};

const started = await runtime.start("test.approval", {}, context);
assert.equal(started.status, "awaiting_input");
assert.equal((await runtime.getState(started.executionId)).status, "awaiting_input");
await runtime.signal(started.executionId, { type: "approved", payload: {} });
assert.equal((await runtime.getState(started.executionId)).status, "completed");

const resumable = await runtime.start("test.approval", {}, context);
assert.equal((await runtime.resume(resumable.executionId, context)).status, "completed");
const compensable = await runtime.start("test.approval", {}, context);
assert.equal((await runtime.compensate(compensable.executionId, context)).status, "compensated");
assert.ok(observed.includes("workflow.started"));
assert.ok(observed.includes("workflow.completed"));
assert.ok(observed.includes("workflow.compensated"));
assert.ok(audit.list().length >= 5);

const identity = new InMemoryIdentityRuntime();
identity.registerUser({ userId: "manager", organizationId: "org", roles: ["manager"] });
const policy = new InMemoryPolicyRuntime();
await policy.registerPolicy({
  id: "approval-start",
  description: "Managers start approval workflows.",
  resource: "test.approval",
  action: "start",
  rules: [{ rolesAll: ["manager"] }],
});
const canonical = new OipRuntime({
  identity,
  policy,
  workflow: runtime,
  decision: {
    decide: async () => ({
      type: "plan",
      plan: {
        planId: "workflow-plan",
        steps: [{ stepId: "approval", type: "workflow", workflowId: "test.approval", arguments: {}, dependencies: [] }],
        requiresConfirmation: false,
        explanation: "Start governed approval workflow.",
      },
    }),
  },
});
const workflowOutcome = await canonical.handle({
  channel: "api", rawPayload: { text: "start approval" }, text: "start approval",
  headers: { authorization: "Bearer manager" },
}, new DirectIntentInterpreter({ type: "command", goal: "approval", rawText: "start approval", confidence: 1, entities: [] }));
assert.equal(workflowOutcome.status, "completed");
console.log("ok - durable workflow runtime persists, signals, resumes, compensates, emits and audits");
