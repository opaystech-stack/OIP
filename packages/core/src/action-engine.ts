import type { ActionResult, AuditLogger, EventPublisher, PlannedAction, RuntimeContext } from "./types.js";
import { CapabilityRegistry, ToolRegistry } from "./registry.js";
import { Validator } from "./validator.js";

export class ActionEngine {
  constructor(
    private readonly capabilities: CapabilityRegistry,
    private readonly tools: ToolRegistry,
    private readonly validator: Validator,
    private readonly events?: EventPublisher,
    private readonly audit?: AuditLogger,
  ) {}

  async execute(plan: PlannedAction, context: RuntimeContext): Promise<ActionResult> {
    const capability = this.capabilities.get(plan.capabilityId);

    if (!capability) {
      throw new Error(`Unknown capability: ${plan.capabilityId}`);
    }

    const validation = this.validator.validate(capability, plan.arguments, context);

    if (!validation.allowed) {
      await this.recordAudit(plan.capabilityId, "rejected", "validation_failed", context, {
        issues: validation.issues.map((issue) => ({
          code: issue.code,
          message: issue.message,
          field: issue.field ?? null,
        })),
      });

      return {
        capabilityId: plan.capabilityId,
        status: "rejected",
        data: {
          issues: validation.issues.map((issue) => ({
            code: issue.code,
            message: issue.message,
            field: issue.field ?? null,
          })),
        },
        events: [],
      };
    }

    if (validation.requiresConfirmation && !isCapabilityConfirmed(plan.capabilityId, context)) {
      await this.recordAudit(plan.capabilityId, "rejected", "confirmation_required", context);

      return {
        capabilityId: plan.capabilityId,
        status: "rejected",
        data: {
          issues: [
            {
              code: "confirmation_required",
              message: `Capability requires explicit confirmation: ${plan.capabilityId}`,
              field: null,
            },
          ],
        },
        events: [],
      };
    }

    const tool = this.tools.get(plan.capabilityId);

    if (!tool) {
      throw new Error(`No tool registered for capability: ${plan.capabilityId}`);
    }

    const result = await tool.execute(plan.arguments, context);

    for (const event of result.events) {
      await this.events?.publish(event, context);
    }

    await this.recordAudit(plan.capabilityId, result.status, "action_executed", context, result.data);

    return result;
  }

  private async recordAudit(
    capabilityId: string,
    status: ActionResult["status"],
    reason: string,
    context: RuntimeContext,
    metadata?: ActionResult["data"],
  ): Promise<void> {
    await this.audit?.record({
      requestId: context.requestId,
      organizationId: context.user.organizationId,
      userId: context.user.userId,
      capabilityId,
      status,
      reason,
      occurredAt: new Date().toISOString(),
      ...(metadata ? { metadata } : {}),
    });
  }
}

function isCapabilityConfirmed(capabilityId: string, context: RuntimeContext): boolean {
  const confirmed = context.metadata?.confirmedCapabilities;

  return Array.isArray(confirmed) && confirmed.includes(capabilityId);
}
