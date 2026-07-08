import type { LlmAdapter } from "../../llm-adapter/src/index.js";
import { LlmPlanner } from "../../planner/src/index.js";
import type {
  Capability,
  DecisionResult,
  ExecutionContext,
  ExecutionPlan,
  ExecutionStep,
  Intention,
  PlannedAction,
  DecisionRuntime,
} from "../../core/src/contracts/index.js";

export interface Planner {
  plan(input: string): Promise<PlannedAction>;
}

export class LlmBasedDecisionRuntime implements DecisionRuntime, Planner {
  private readonly planner: LlmPlanner;

  constructor(llm: LlmAdapter, capabilities: readonly Capability[]) {
    this.planner = new LlmPlanner(llm, capabilities);
  }

  async plan(input: string): Promise<PlannedAction> {
    return this.planner.plan(input);
  }

  async decide(_intention: Intention, _context: ExecutionContext): Promise<DecisionResult> {
    return {
      type: "clarify",
      question: "LLM-based decision requires raw input. Use plan(input) instead.",
      candidates: [],
    };
  }
}

export type { DecisionRuntime, ExecutionPlan, ExecutionStep, Intention, PlannedAction } from "../../core/src/contracts/index.js";
export type { LlmAdapter } from "../../llm-adapter/src/index.js";
export { LlmPlanner } from "../../planner/src/index.js";
