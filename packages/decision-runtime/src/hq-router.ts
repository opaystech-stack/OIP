import type { ExecutionContext, ExecutionPlan, ExecutionStep } from "../../core/src/contracts/index.js";
import type { Intention } from "../../core/src/contracts/intention.js";
import type { CapabilityCandidate, DecisionResult } from "../../core/src/contracts/plan.js";
import type { JsonObject, JsonValue } from "../../core/src/contracts/common.js";
import type { HqAction, HqActionRegistry } from "../../hq-connector/src/index.js";

/**
 * HqRoutingDecisionRuntime — first minimal Intent Router for OIP v2.
 *
 * It links a user's semantic Intention to capabilities dynamically discovered
 * from Opays HQ via HqActionRegistry, then produces an ExecutionPlan that the
 * OIP orchestration can execute.
 *
 * Governance boundaries:
 * - This router does NOT contain business logic. HQ owns all business rules.
 * - It does NOT call the LLM by default. Scoring is deterministic and
 *   unit-testable. A semantic resolver can be injected later for fuzzy matching.
 * - It returns "clarify" when confidence is low, so the orchestration layer
 *   (not the LLM) decides whether to ask the user.
 */

export interface HqRoutingOptions {
  readonly registry: HqActionRegistry;
  /**
   * Optional custom resolver for fuzzy / semantic matching.
   * If provided and the local score is below threshold, the resolver is asked
   * to pick the best capability from the discovered snapshot.
   */
  readonly resolve?: (intent: Intention, actions: readonly HqAction[]) => Promise<HqAction | undefined>;
  /**
   * Score above which we route directly to a capability. Between 0 and 1.
   * Default: 0.4
   */
  readonly routingThreshold?: number;
  /**
   * Score above which we include the capability as a clarification candidate.
   * Default: 0.1
   */
  readonly candidateThreshold?: number;
}

export interface ScoredAction {
  readonly action: HqAction;
  readonly score: number;
  readonly reason: string;
}

export class HqRoutingDecisionRuntime {
  constructor(private readonly options: HqRoutingOptions) {}

  async decide(intent: Intention, _context: ExecutionContext): Promise<DecisionResult> {
    await this.options.registry.discover();
    const actions = this.options.registry.list();

    if (actions.length === 0) {
      return { type: "reject", reason: "No HQ capabilities are currently available." };
    }

    const scored = scoreActions(intent, actions);
    const threshold = this.options.routingThreshold ?? 0.4;
    const candidateThreshold = this.options.candidateThreshold ?? 0.1;

    const best = scored[0];
    if (!best || best.score < candidateThreshold) {
      return {
        type: "reject",
        reason: "The request does not match any available HQ capability.",
      };
    }

    if (best.score < threshold) {
      return {
        type: "clarify",
        question: "Which action do you want to perform?",
        candidates: scored
          .filter((s) => s.score >= candidateThreshold)
          .map((s) => ({
            capabilityId: s.action.id,
            score: s.score,
            reason: s.reason,
          })),
      };
    }

    if (this.options.resolve && best.score <= 0.75) {
      const resolved = await this.options.resolve(intent, actions);
      if (resolved && resolved.id !== best.action.id) {
        const resolvedScore = scored.find((s) => s.action.id === resolved.id);
        return this.buildPlan(intent, resolved, resolvedScore?.score ?? 0.6, "semantic resolver");
      }
    }

    return this.buildPlan(intent, best.action, best.score, best.reason);
  }

  private buildPlan(intent: Intention, action: HqAction, score: number, reason: string): DecisionResult {
    const args = extractArguments(intent, action);
    const step: ExecutionStep = {
      stepId: "step-1",
      type: "action",
      capabilityId: action.id,
      arguments: args,
      dependencies: [],
    };

    const plan: ExecutionPlan = {
      planId: `plan-${Date.now()}`,
      steps: [step],
      requiresConfirmation: action.requiredRoles != null && action.requiredRoles.length > 0,
      explanation: `Route '${intent.goal}' to HQ capability '${action.id}' (${reason}, score=${score.toFixed(2)}).`,
    };

    return { type: "plan", plan };
  }
}

function scoreActions(intent: Intention, actions: readonly HqAction[]): ScoredAction[] {
  const text = `${intent.goal} ${intent.rawText}`.toLowerCase().trim();
  const words = new Set(text.split(/\s+/).filter((w) => w.length >= 3));
  const goalWords = intent.goal.toLowerCase().trim().split(/\s+/).filter(Boolean);

  return actions
    .map((action) => {
      const haystack = `${action.id} ${action.description ?? ""}`.toLowerCase();
      const haystackWords = new Set(haystack.split(/[^a-z]+/).filter((w) => w.length >= 2));

      let matches = 0;
      words.forEach((w) => {
        if (haystackWords.has(w)) matches += 1;
        // Partial match for longer words (e.g. "tâche" vs "task" is not handled,
        // but "créer" vs "create" is also not cognate; rely on description).
      });

      // Strong boost when the entire capability id appears as a substring.
      const idBonus = text.includes(action.id.toLowerCase()) ? 0.35 : 0;
      // Description word overlap boost.
      const description = (action.description ?? "").toLowerCase();
      const descBonus = goalWords.some((gw) => description.includes(gw)) ? 0.25 : 0;

      const score = Math.min(1, (words.size > 0 ? matches / words.size : 0) + idBonus + descBonus);
      return {
        action,
        score,
        reason: `local lexical match: ${matches}/${words.size} words (idBonus=${idBonus}, descBonus=${descBonus})`,
      };
    })
    .sort((a, b) => b.score - a.score);
}

function extractArguments(intent: Intention, action: HqAction): JsonObject {
  const mutableArgs: Record<string, JsonValue> = {};
  const entityMap = new Map(intent.entities.map((e) => [e.name, e.value]));

  const schemaProperties =
    action.inputSchema && typeof action.inputSchema === "object" && !Array.isArray(action.inputSchema)
      ? (action.inputSchema as JsonObject).properties
      : undefined;

  if (isJsonObject(schemaProperties)) {
    for (const key of Object.keys(schemaProperties)) {
      const value = entityMap.get(key);
      if (value !== undefined) {
        mutableArgs[key] = value as JsonValue;
      }
    }
  } else {
    // Fallback: copy all entities when no schema is provided.
    entityMap.forEach((value, key) => {
      mutableArgs[key] = value as JsonValue;
    });
  }

  return mutableArgs as JsonObject;
}

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export type { DecisionResult, ExecutionPlan } from "../../core/src/contracts/plan.js";
export type { Intention } from "../../core/src/contracts/intention.js";
export type { HqAction } from "../../hq-connector/src/index.js";
