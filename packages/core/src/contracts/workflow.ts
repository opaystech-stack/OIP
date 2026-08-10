import type { JsonObject } from "./common.js";

export interface WorkflowSignal {
  readonly type: string;
  readonly payload: JsonObject;
}

export interface WorkflowStepState {
  readonly stepId: string;
  readonly status: "pending" | "running" | "completed" | "failed" | "awaiting_input" | "compensated";
  readonly result?: JsonObject;
  readonly error?: string;
}

export interface WorkflowExecution {
  readonly executionId: string;
  readonly workflowId: string;
  readonly status: "pending" | "running" | "completed" | "failed" | "awaiting_input" | "compensating" | "compensated";
  readonly steps: readonly WorkflowStepState[];
  readonly updatedAt?: string;
}

/** Persistence port for durable workflow execution state. */
export interface WorkflowExecutionStore {
  save(execution: WorkflowExecution): Promise<void>;
  load(executionId: string): Promise<WorkflowExecution | undefined>;
  list(workflowId?: string): Promise<readonly WorkflowExecution[]>;
}

export interface WorkflowDefinition {
  readonly id: string;
  readonly pluginId: string;
  readonly description: string;
  readonly steps: readonly JsonObject[];
}
