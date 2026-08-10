import type {
  AgentCatalog,
  Capability,
  DecisionResult,
  ExecutionContext,
  ExecutionPlan,
  ExecutionStep,
  Intention,
  PlannedAction,
  DecisionRuntime,
} from "../../core/src/contracts/index.js";

export class RuleBasedDecisionRuntime implements DecisionRuntime {
  constructor(private readonly capabilities: readonly Capability[] = []) {}

  async decide(intent: Intention, _context: ExecutionContext): Promise<DecisionResult> {
    const best = this.findBestCapability(intent);

    if (!best) {
      return { type: "reject", reason: "No matching capability found." };
    }

    const action: PlannedAction = {
      capabilityId: best.id,
      arguments: this.extractArguments(intent, best),
      confidence: 1,
      reason: `Rule-based match on intent type "${intent.type}".`,
    };

    const plan: ExecutionPlan = {
      planId: `plan-${Date.now()}`,
      steps: [
        {
          stepId: "step-1",
          type: "action",
          capabilityId: action.capabilityId,
          arguments: action.arguments,
          dependencies: [],
        } satisfies ExecutionStep,
      ],
      requiresConfirmation: best.confirmationLevel !== "none",
      explanation: action.reason,
    };

    return { type: "plan", plan };
  }

  private findBestCapability(intent: Intention): Capability | undefined {
    const entityValues = intent.entities.map((e) => String(e.value)).join(" ");
    const searchableText = `${intent.goal} ${intent.rawText} ${intent.entities.map((e) => e.name).join(" ")} ${entityValues}`.toLowerCase();

    return this.capabilities.find((capability) => {
      const normalizedId = capability.id.toLowerCase();
      const normalizedDescription = capability.description.toLowerCase();
      const matches =
        normalizedId.includes(searchableText) ||
        normalizedDescription.includes(searchableText) ||
        searchableText.includes(normalizedId) ||
        searchableText.includes(normalizedDescription);
      return matches;
    });
  }

  private extractArguments(intent: Intention, capability: Capability): import("../../core/src/contracts/common.js").JsonObject {
    const args: Record<string, import("../../core/src/contracts/common.js").JsonValue> = {};

    for (const parameter of capability.parameters) {
      const entity = intent.entities.find((e) => e.name === parameter.name);
      const value = entity?.value;
      if (value === undefined) continue;
      if (
        value === null ||
        typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean" ||
        Array.isArray(value) ||
        typeof value === "object"
      ) {
        args[parameter.name] = value as import("../../core/src/contracts/common.js").JsonValue;
      }
    }

    return args;
  }
}

/** Deterministic canonical decision engine; providers never select capabilities. */
export class DecisionEngine implements DecisionRuntime {
  constructor(
    private readonly capabilities: () => readonly Capability[],
    private readonly agents?: AgentCatalog,
  ) {}

  async decide(intent: Intention, _context: ExecutionContext): Promise<DecisionResult> {
    const ranked = this.capabilities()
      .map((capability) => ({ capability, score: scoreCapability(intent, capability) }))
      .sort((left, right) => right.score - left.score);
    const best = ranked[0];
    if (!best || best.score === 0) {
      return { type: "clarify", question: "I could not identify a governed capability for this intention.", candidates: [] };
    }
    const arguments_: Record<string, import("../../core/src/contracts/common.js").JsonValue> = {};
    for (const parameter of best.capability.parameters) {
      const entity = intent.entities.find((candidate) => candidate.name === parameter.name);
      if (entity) arguments_[parameter.name] = entity.value;
    }
    return {
      type: "plan",
      plan: {
        planId: `plan-${Date.now()}`,
        ...(this.agents?.select(intent) ? { agentId: this.agents.select(intent)!.id } : {}),
        steps: [{ stepId: "step-1", type: "action", capabilityId: best.capability.id, arguments: arguments_, dependencies: [] }],
        requiresConfirmation: best.capability.confirmationLevel !== "none",
        explanation: `Decision score ${best.score.toFixed(2)} for ${best.capability.id}.`,
      },
    };
  }
}

function scoreCapability(intent: Intention, capability: Capability): number {
  const query = [...words(`${intent.goal} ${intent.rawText} ${intent.entities.map((entity) => entity.name).join(" ")}`)];
  const candidate = words(`${capability.id} ${capability.description}`);
  const overlap = query.filter((word) => candidate.has(word)).length;
  const parameterMatches = capability.parameters.filter((parameter) => intent.entities.some((entity) => entity.name === parameter.name)).length;
  return overlap + parameterMatches * 2;
}

function words(value: string): Set<string> {
  return new Set(value.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((word) => word.length > 1));
}

export type { DecisionResult, DecisionRuntime, ExecutionPlan, Intention, PlannedAction } from "../../core/src/contracts/index.js";
export { HqRoutingDecisionRuntime, type ScoredAction, type HqRoutingOptions } from "./hq-router.js";
