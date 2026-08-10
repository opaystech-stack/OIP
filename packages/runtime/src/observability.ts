import type { DecisionResult, Intention } from "../../core/src/contracts/index.js";

export interface RuntimeExecutionRecord {
  readonly requestId: string;
  readonly organizationId?: string;
  readonly userId?: string;
  readonly status: "completed" | "rejected" | "clarification_required" | "confirmation_required" | "error";
  readonly startedAt: string;
  readonly durationMs: number;
  readonly intention?: Intention;
  readonly decisionType?: DecisionResult["type"];
  readonly planId?: string;
  readonly agentId?: string;
  readonly actionCapabilityIds: readonly string[];
  readonly providerId?: string;
  readonly model?: string;
  readonly promptTokens?: number;
  readonly completionTokens?: number;
  readonly costUsd?: number;
  readonly error?: string;
}

export interface RuntimeExecutionObservability {
  record(entry: RuntimeExecutionRecord): Promise<void>;
}

/** Reference observability sink; replace with OpenTelemetry/Langfuse adapters in production. */
export class InMemoryRuntimeExecutionObservability implements RuntimeExecutionObservability {
  private readonly entries: RuntimeExecutionRecord[] = [];
  async record(entry: RuntimeExecutionRecord): Promise<void> { this.entries.push(entry); }
  list(): readonly RuntimeExecutionRecord[] { return [...this.entries]; }
}
