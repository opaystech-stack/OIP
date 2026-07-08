import type { JsonObject } from "./common.js";

export interface ExecutionStep {
  readonly stepId: string;
  readonly type: "action" | "workflow" | "skill" | "clarify";
  readonly capabilityId?: string;
  readonly workflowId?: string;
  readonly skillId?: string;
  readonly arguments: JsonObject;
  readonly dependencies: readonly string[];
}

export interface ExecutionPlan {
  readonly planId: string;
  readonly steps: readonly ExecutionStep[];
  readonly requiresConfirmation: boolean;
  readonly explanation: string;
}

export interface CapabilityCandidate {
  readonly capabilityId: string;
  readonly score: number;
  readonly reason: string;
}

export type DecisionResult =
  | { readonly type: "plan"; readonly plan: ExecutionPlan }
  | { readonly type: "clarify"; readonly question: string; readonly candidates: readonly CapabilityCandidate[] }
  | { readonly type: "reject"; readonly reason: string };

export interface PlannedAction {
  readonly capabilityId: string;
  readonly arguments: JsonObject;
  readonly confidence: number;
  readonly reason: string;
}
