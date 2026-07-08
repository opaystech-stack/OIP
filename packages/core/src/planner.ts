import type { PlannedAction } from "./types.js";

export interface Planner {
  plan(input: string): Promise<PlannedAction>;
}

export class RuleBasedPlanner implements Planner {
  async plan(input: string): Promise<PlannedAction> {
    const normalized = input.toLowerCase();
    const quantityMatch = normalized.match(/(\d+)/);
    const quantity = quantityMatch ? Number(quantityMatch[1]) : 1;

    if (normalized.includes("stock") || normalized.includes("inventaire")) {
      return {
        capabilityId: "commerce.inventory.add",
        arguments: {
          itemName: extractItemName(input),
          quantity,
        },
        confidence: 0.72,
        reason: "Detected an inventory update request.",
      };
    }

    throw new Error(`No planning rule matched input: ${input}`);
  }
}

function extractItemName(input: string): string {
  const withoutQuantity = input.replace(/\d+/g, " ").trim();
  const stockIndex = withoutQuantity.toLowerCase().indexOf("stock");

  if (stockIndex >= 0) {
    return withoutQuantity.slice(0, stockIndex).replace(/ajoute|ajouter|au|a la|à la/gi, "").trim();
  }

  return withoutQuantity;
}
