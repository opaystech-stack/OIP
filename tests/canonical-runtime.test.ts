import { strict as assert } from "node:assert";
import { definePluginModule } from "../packages/plugin-sdk/src/index.js";
import { InMemoryIdentityRuntime } from "../packages/identity-runtime/src/index.js";
import { DirectIntentInterpreter, OipRuntime } from "../packages/runtime/src/index.js";

async function run(): Promise<void> {
  const identity = new InMemoryIdentityRuntime();
  identity.registerUser({
    userId: "manager-1",
    organizationId: "commerce",
    roles: ["inventory.manager"],
    locale: "fr",
  });
  identity.registerUser({ userId: "viewer-1", organizationId: "commerce", roles: [] });
  const plugin = definePluginModule({
    plugin: {
      id: "test",
      name: "Canonical runtime test plugin",
      capabilities: [{
        id: "test.inventory.add",
        description: "Add inventory through a governed runtime.",
        parameters: [
          { name: "itemName", type: "string", required: true, description: "Inventory item." },
          { name: "quantity", type: "number", required: true, description: "Quantity." },
        ],
        requiredRoles: ["inventory.manager"],
        confirmationLevel: "none",
        sideEffects: ["inventory_quantity_increases"],
        emits: ["InventoryUpdated"],
      }],
      tools: new Map([["test.inventory.add", {
        execute: async (arguments_) => ({
          capabilityId: "test.inventory.add",
          status: "completed" as const,
          data: arguments_,
          events: [{ type: "InventoryUpdated", payload: arguments_, occurredAt: new Date().toISOString() }],
        }),
      }]]),
    },
  });
  const runtime = new OipRuntime({ identity }).use(plugin);
  runtime.documents.ingest({ title: "Inventory policy", text: "Inventory additions are governed." });

  const completed = await runtime.handle({
    channel: "api",
    rawPayload: { text: "Add five coffee bags" },
    text: "Add five coffee bags",
    headers: { authorization: "Bearer manager-1" },
    metadata: { requestId: "canonical-1" },
  }, new DirectIntentInterpreter({
    type: "command",
    goal: "inventory replenishment",
    confidence: 1,
    rawText: "Add five coffee bags",
    entities: [{ name: "itemName", value: "coffee" }, { name: "quantity", value: 5 }],
  }));

  assert.equal(completed.status, "completed");
  assert.equal(completed.actions[0]?.status, "completed");
  assert.equal(completed.context.knowledge?.length, 1);
  assert.equal((await runtime.memory.recent({
    requestId: "read", channel: "api", user: { userId: "manager-1", organizationId: "commerce", roles: [] },
  }, 1))[0]?.input, "Add five coffee bags");
  assert.equal((runtime.events.list?.() as readonly unknown[] | undefined)?.length, 1);
  assert.equal((runtime.audit.list?.() as readonly unknown[] | undefined)?.length, 1);
  assert.equal(runtime.executionObservability.list()[0]?.status, "completed");
  assert.equal(runtime.executionObservability.list()[0]?.decisionType, "plan");
  assert.equal(runtime.executionObservability.list()[0]?.actionCapabilityIds[0], "test.inventory.add");

  const denied = await runtime.handle({
    channel: "api", rawPayload: { text: "Add coffee" }, text: "Add coffee",
    headers: { authorization: "Bearer viewer-1" }, metadata: { requestId: "canonical-2" },
  }, new DirectIntentInterpreter({
    type: "command", goal: "inventory replenishment", confidence: 1, rawText: "Add coffee",
    entities: [{ name: "itemName", value: "coffee" }, { name: "quantity", value: 1 }],
  }));
  assert.equal(denied.status, "rejected");
  assert.equal(denied.actions.length, 0);
  assert.equal(runtime.executionObservability.list()[1]?.status, "rejected");
  console.log("ok - canonical runtime governs identity, context, decision, policy, execution, memory and events");
}

run();
