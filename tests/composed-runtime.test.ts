import { strict as assert } from "node:assert";
import { ComposedRuntime, OipRuntimeBuilder } from "../packages/runtime/src/builder.js";
import { commercePluginModule } from "../plugins/commerce/src/index.js";
import { InMemoryIdentityRuntime } from "../packages/identity-runtime/src/index.js";
import { InMemoryPolicyRuntime } from "../packages/policy-runtime/src/index.js";

function equal(actual: unknown, expected: unknown): void {
  if (actual !== expected) {
    throw new Error(`Expected ${String(expected)}, received ${String(actual)}.`);
  }
}

async function runTests(): Promise<void> {
  const identity = new InMemoryIdentityRuntime();
  identity.registerUser({
    userId: "manager-1",
    organizationId: "commerce",
    roles: ["inventory.manager"],
    locale: "fr",
  });

  const runtime = new OipRuntimeBuilder()
    .withIdentityRuntime(identity)
    .withPolicyRuntime(new InMemoryPolicyRuntime())
    .buildComposed()
    .use(commercePluginModule);

  assert.ok(runtime instanceof ComposedRuntime, "buildComposed must return a ComposedRuntime");

  equal(runtime.capabilities.list().length, 1);
  console.log("Capabilities:", runtime.capabilities.list().map((c) => c.id).join(", "));

  const request = {
    channel: "api" as const,
    rawPayload: { input: "add 5 units of coffee to inventory" },
    headers: {
      authorization: "Bearer manager-1",
    },
    metadata: {
      requestId: "req-1",
    },
  };

  const resolved = await runtime.authenticate(request);
  equal(resolved.userId, "manager-1");

  const context = await runtime.buildContext(request);
  equal(context.identity.userId, "manager-1");
  equal(context.channel, "api");

  const decision = await runtime.decide(
    {
      type: "command",
      confidence: 1,
      entities: [
        { name: "quantity", value: 5 },
        { name: "itemName", value: "coffee" },
        { name: "capability", value: "commerce.inventory.add" },
      ],
      rawText: "add 5 units of coffee to inventory",
      goal: "commerce.inventory.add",
    },
    context,
  );

  if (decision.type !== "plan") {
    console.error("Decision rejected:", decision);
    throw new Error(`Expected a plan decision, got ${decision.type}`);
  }

  if (decision.plan.steps.length === 0) {
    throw new Error("Expected at least one step in the plan");
  }
  const step = decision.plan.steps[0]!;
  if (!step.capabilityId) {
    throw new Error("Expected the first step to have a capabilityId");
  }
  equal(step.capabilityId, "commerce.inventory.add");

  const action = {
    capabilityId: step.capabilityId,
    arguments: step.arguments,
    confidence: 1,
    reason: "composed execution",
  };

  const result = await runtime.execute(action, context);
  equal(result.status, "completed");

  console.log("ok - ComposedRuntime installs Commerce plugin and executes a capability");

  const defaults = new OipRuntimeBuilder().buildComposed();
  equal(defaults instanceof ComposedRuntime, true);
  equal(defaults.capabilities.list().length, 0);

  console.log("ok - ComposedRuntime uses defaults when no Runtimes are injected");
  console.log("All ComposedRuntime tests passed.");
}

runTests();
