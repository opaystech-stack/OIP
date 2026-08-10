import { strict as assert } from "node:assert";
import { ProviderRegistry } from "../packages/llm-runtime/src/index.js";
import { AgentRegistry } from "../packages/runtime/src/index.js";

const runtime = {
  generateText: async () => "",
  generateJson: async <T>() => ({}) as T,
  embed: async () => [],
};

const providers = new ProviderRegistry();
providers.register({ definition: { id: "provider-a", capabilities: ["text", "json"], priority: 1 }, runtime });
providers.register({ definition: { id: "provider-b", capabilities: ["text", "json", "embedding"], priority: 2 }, runtime });
assert.equal(providers.resolve(["json", "embedding"])?.definition.id, "provider-b");
assert.equal(providers.resolve(["json"], "provider-a")?.definition.id, "provider-a");

const agents = new AgentRegistry();
agents.register({
  id: "inventory-agent",
  description: "Governed inventory operations.",
  capabilities: ["inventory", "replenishment"],
  memoryScopes: ["conversation", "workspace"],
  preferredProviderId: "provider-b",
  requiredProviderCapabilities: ["json"],
  budget: { maxTokens: 1000, maxSteps: 3 },
  permissions: ["inventory.read"],
  toolIds: [],
  policyIds: ["inventory-policy"],
});
assert.equal(agents.select({
  type: "command", goal: "inventory replenishment", rawText: "replenish inventory", confidence: 1, entities: [],
})?.id, "inventory-agent");
console.log("ok - provider and agent registries select by capability without vendor coupling");
