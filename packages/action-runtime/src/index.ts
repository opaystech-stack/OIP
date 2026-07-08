import type {
  ActionResult,
  ActionRuntime,
  ExecutionContext,
  PlannedAction,
  ToolHandler,
} from "../../core/src/contracts/index.js";
import { ActionEngine, CapabilityRegistry, ToolRegistry, Validator } from "../../core/src/index.js";
import type { AuditLogger, EventPublisher } from "../../core/src/index.js";

export class ActionEngineRuntime implements ActionRuntime {
  private readonly engine: ActionEngine;

  constructor(
    capabilities: CapabilityRegistry,
    tools: ToolRegistry,
    events: EventPublisher,
    audit: AuditLogger,
  ) {
    this.engine = new ActionEngine(capabilities, tools, new Validator(), events, audit);
  }

  async execute(action: PlannedAction, context: ExecutionContext): Promise<ActionResult> {
    return this.engine.execute(action, context as unknown as import("../../core/src/types.js").RuntimeContext);
  }
}

export type { ActionResult, ActionRuntime, PlannedAction, ToolHandler } from "../../core/src/contracts/index.js";
