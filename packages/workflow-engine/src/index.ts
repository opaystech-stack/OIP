import type { ActionEngine, JsonObject, RuntimeContext, ValidationIssue } from "../../core/src/index.js";

export interface WorkflowDefinition {
  readonly id: string;
  readonly description: string;
  readonly requiredRoles: readonly string[];
}

export interface WorkflowResult {
  readonly workflowId: string;
  readonly status: "completed" | "rejected";
  readonly data?: JsonObject;
  readonly steps: readonly WorkflowStepResult[];
}

export interface WorkflowStepResult {
  readonly id: string;
  readonly status: "completed" | "rejected";
  readonly capabilityId?: string;
  readonly data?: JsonObject;
}

export interface WorkflowHandler {
  execute(args: JsonObject, context: RuntimeContext, actions: ActionEngine): Promise<WorkflowResult>;
}

export class WorkflowRegistry {
  private readonly definitions = new Map<string, WorkflowDefinition>();
  private readonly handlers = new Map<string, WorkflowHandler>();

  register(definition: WorkflowDefinition, handler: WorkflowHandler): void {
    if (this.definitions.has(definition.id)) {
      throw new Error(`Workflow already registered: ${definition.id}`);
    }

    this.definitions.set(definition.id, definition);
    this.handlers.set(definition.id, handler);
  }

  get(workflowId: string): { readonly definition: WorkflowDefinition; readonly handler: WorkflowHandler } | undefined {
    const definition = this.definitions.get(workflowId);
    const handler = this.handlers.get(workflowId);

    if (!definition || !handler) {
      return undefined;
    }

    return { definition, handler };
  }
}

export class WorkflowEngine {
  constructor(
    private readonly registry: WorkflowRegistry,
    private readonly actions: ActionEngine,
  ) {}

  async execute(workflowId: string, args: JsonObject, context: RuntimeContext): Promise<WorkflowResult> {
    const workflow = this.registry.get(workflowId);

    if (!workflow) {
      throw new Error(`Unknown workflow: ${workflowId}`);
    }

    const issues = validateRoles(workflow.definition.requiredRoles, context);

    if (issues.length > 0) {
      return {
        workflowId,
        status: "rejected",
        data: { issues: issues.map((issue) => ({ ...issue, field: issue.field ?? null })) },
        steps: [],
      };
    }

    return workflow.handler.execute(args, context, this.actions);
  }
}

function validateRoles(requiredRoles: readonly string[], context: RuntimeContext): ValidationIssue[] {
  return requiredRoles
    .filter((role) => !context.user.roles.includes(role))
    .map((role) => ({
      code: "missing_role",
      message: `User is missing required role: ${role}`,
    }));
}
