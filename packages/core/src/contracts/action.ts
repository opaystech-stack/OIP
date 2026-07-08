import type { JsonObject } from "./common.js";

export interface ActionError {
  readonly code: string;
  readonly message: string;
  readonly field?: string;
  readonly recoverable: boolean;
}

export interface ActionResult {
  readonly capabilityId: string;
  readonly status: "completed" | "rejected";
  readonly data?: JsonObject;
  readonly events: readonly import("./event.js").DomainEvent[];
}

export interface ToolHandler {
  execute(args: JsonObject, context: import("./context.js").ExecutionContext): Promise<ActionResult>;
}
