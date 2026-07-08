import type {
  ActionResult,
  ActionRuntime,
  ExecutionContext,
  PlannedAction,
  ToolHandler,
} from "../../core/src/contracts/index.js";
import { ActionEngine, CapabilityRegistry, ToolRegistry, Validator } from "../../core/src/index.js";
import type { AuditLogger, EventPublisher, RuntimeContext } from "../../core/src/index.js";

function toRuntimeContext(context: ExecutionContext): RuntimeContext {
  return {
    requestId: context.requestId,
    channel: context.channel,
    user: {
      userId: context.identity.userId,
      organizationId: context.identity.organizationId,
      roles: context.identity.roles,
      locale: context.identity.locale ?? "fr",
      ...(context.identity.activeModule !== undefined ? { activeModule: context.identity.activeModule } : {}),
      ...(context.identity.activePage !== undefined ? { activePage: context.identity.activePage } : {}),
    },
    metadata: context.metadata ?? {},
  };
}

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
    return this.engine.execute(action, toRuntimeContext(context));
  }
}

export type { ActionResult, ActionRuntime, PlannedAction, ToolHandler } from "../../core/src/contracts/index.js";
