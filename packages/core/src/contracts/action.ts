import type { JsonObject } from "./common.js";

export interface ActionError {
  readonly code: string;
  readonly message: string;
  readonly field?: string;
  readonly recoverable: boolean;
}

export interface ActionResult {
  readonly capabilityId: string;
  readonly status: "completed" | "rejected" | "pending" | "awaiting_confirmation";
  readonly data?: JsonObject;
  readonly events: readonly JsonObject[];
  readonly errors?: readonly ActionError[];
  readonly auditId: string;
}

export interface ToolHandler {
  execute(args: JsonObject, context: unknown): Promise<ActionResult>;
}
