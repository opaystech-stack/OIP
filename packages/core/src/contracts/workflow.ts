import type { JsonObject } from "./common.js";

export interface WorkflowSignal {
  readonly type: string;
  readonly payload: JsonObject;
}

export interface WorkflowStepState {
  readonly stepId: string;
  readonly status: "pending" | "running" | "completed" | "failed" | "awaiting_input";
  readonly result?: JsonObject;
  readonly error?: string;
}

export interface WorkflowExecution {
  readonly executionId: string;
  readonly workflowId: string;
  readonly status: "pending" | "running" | "completed" | "failed" | "awaiting_input";
  readonly steps: readonly WorkflowStepState[];
}

export interface WorkflowDefinition {
  readonly id: string;
  readonly pluginId: string;
  readonly description: string;
  readonly steps: readonly JsonObject[];
}
