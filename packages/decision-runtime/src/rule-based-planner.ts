import type { PlannedAction } from "../../core/src/types.js";
import type { Capability, ExecutionContext, Intention } from "../../core/src/contracts/index.js";
import { RuleBasedDecisionRuntime } from "./index.js";

export interface Planner {
  plan(input: string): Promise<PlannedAction>;
}

export class RuleBasedPlanner implements Planner {
  private readonly runtime: RuleBasedDecisionRuntime;

  constructor(capabilities: readonly Capability[] = []) {
    this.runtime = new RuleBasedDecisionRuntime(capabilities);
  }

  async plan(input: string): Promise<PlannedAction> {
    const normalized = input.toLowerCase();
    const quantityMatch = normalized.match(/(\d+)/);
    const quantity = quantityMatch ? Number(quantityMatch[1]) : 1;

    const context: ExecutionContext = {
      requestId: `plan-${Date.now()}`,
      identity: {
        userId: "anonymous",
        organizationId: "default",
        roles: [],
      },
      channel: "api",
    };

    const intention: Intention = {
      type: "command",
      confidence: 1,
      rawText: input,
      goal: normalized.includes("stock") || normalized.includes("inventaire")
        ? "commerce.inventory.add"
        : input,
      entities: [
        { name: "quantity", value: quantity },
        { name: "itemName", value: extractItemName(input) },
      ],
    };

    const result = await this.runtime.decide(intention, context);

    if (result.type !== "plan" || result.plan.steps.length === 0) {
      throw new Error(`No planning rule matched input: ${input}`);
    }

    const step = result.plan.steps[0]!;

    return {
      capabilityId: step.capabilityId!,
      arguments: step.arguments,
      confidence: 0.72,
      reason: "Detected an inventory update request.",
    };
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
