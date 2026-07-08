import type { ActionResult, JsonObject, OipPlugin, RuntimeContext, ToolHandler } from "../../../../packages/core/src/index.js";
import { definePluginModule } from "../../../../packages/plugin-sdk/src/index.js";
import { CommerceRestockWorkflow, commerceRestockWorkflowDefinition } from "./workflows.js";

const inventory: Record<string, number> = {};

class AddInventoryTool implements ToolHandler {
  async execute(args: JsonObject, _context: RuntimeContext): Promise<ActionResult> {
    const itemName = String(args.itemName);
    const quantity = Number(args.quantity);
    const currentQuantity = inventory[itemName] ?? 0;
    const nextQuantity = currentQuantity + quantity;

    inventory[itemName] = nextQuantity;

    return {
      capabilityId: "commerce.inventory.add",
      status: "completed",
      data: {
        itemName,
        quantityAdded: quantity,
        currentQuantity: nextQuantity,
      },
      events: [
        {
          type: "InventoryUpdated",
          occurredAt: new Date().toISOString(),
          payload: {
            itemName,
            quantityAdded: quantity,
            currentQuantity: nextQuantity,
          },
        },
      ],
    };
  }
}

export const commercePlugin: OipPlugin = {
  id: "commerce",
  name: "Opays Commerce",
  capabilities: [
    {
      id: "commerce.inventory.add",
      description: "Add quantity to an inventory item.",
      parameters: [
        {
          name: "itemName",
          type: "string",
          required: true,
          description: "Inventory item name.",
        },
        {
          name: "quantity",
          type: "number",
          required: true,
          description: "Quantity to add.",
        },
      ],
      requiredRoles: ["inventory.manager"],
      confirmationLevel: "low",
      sideEffects: ["inventory_quantity_increases"],
      emits: ["InventoryUpdated"],
    },
  ],
  tools: new Map([["commerce.inventory.add", new AddInventoryTool()]]),
};

export function getInventorySnapshot(): Readonly<Record<string, number>> {
  return { ...inventory };
}

export const commercePluginModule = definePluginModule({
  plugin: commercePlugin,
  workflows: [
    {
      definition: commerceRestockWorkflowDefinition,
      handler: new CommerceRestockWorkflow(),
    },
  ],
});
