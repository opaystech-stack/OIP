import {
  OipRuntime,
  type CapabilityDescriptor,
  type ExecutionContext,
} from "../packages/runtime/src/index.js";
import { commercePlugin, getInventorySnapshot } from "./plugins/commerce/src/index.js";

const capabilityId = "commerce.inventory.add";
const capability = commercePlugin.capabilities.find((candidate) => candidate.id === capabilityId);
const tool = commercePlugin.tools.get(capabilityId);

if (!capability || !tool) {
  throw new Error(`Commerce demo capability is not registered: ${capabilityId}`);
}

const descriptor: CapabilityDescriptor = {
  ...capability,
  keywords: ["stock", "inventaire", "ciment", "ajouter", "restock"],
  aliases: ["ajouter au stock", "réapprovisionner le stock"],
  source: "commerce-demo",
  availability: "available",
  verification: async (actionResult) => ({
    verified: actionResult.status === "completed",
    summary: actionResult.status === "completed"
      ? "Le stock Commerce a été mis à jour."
      : "La mise à jour du stock Commerce a été rejetée.",
    evidence: {
      status: actionResult.status,
      ...(actionResult.data !== undefined ? { data: actionResult.data } : {}),
    },
  }),
};

const runtime = new OipRuntime();
await runtime.registerCapability(descriptor, tool);

const context: ExecutionContext = {
  requestId: "demo-request-001",
  threadId: "demo-thread-001",
  identity: {
    userId: "user-001",
    organizationId: "opays-demo",
    roles: ["inventory.manager"],
    locale: "fr-CD",
    activeModule: "commerce",
    activePage: "inventory",
  },
  channel: "web",
};

const result = await runtime.capabilityGateway.invoke(
  {
    query: "Ajoute 20 sacs de ciment au stock",
    arguments: {
      itemName: "sacs de ciment",
      quantity: 20,
    },
  },
  context,
);

if (result.status !== "completed") {
  throw new Error(`Commerce demo did not complete: ${result.message}`);
}

console.log(JSON.stringify({ result, inventory: getInventorySnapshot() }, null, 2));
