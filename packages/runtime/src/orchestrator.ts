import type {
  ActionResult,
  ActionRuntime,
  ContextRuntime,
  DecisionResult,
  DecisionRuntime,
  ExecutionContext,
  IdentityRuntime,
  InboundRequest,
  Intention,
  MemoryRuntime,
  PolicyDecision,
  PolicyRuntime,
  WorkflowRuntime,
} from "../../core/src/contracts/index.js";
import type { RuntimeExecutionObservability } from "./observability.js";

export interface IntentInterpreter {
  interpret(request: InboundRequest, context: ExecutionContext): Promise<Intention>;
}

export type RuntimeOutcome = {
  readonly status: "completed" | "rejected" | "clarification_required" | "confirmation_required";
  readonly context: ExecutionContext;
  readonly intention: Intention;
  readonly decision: DecisionResult;
  readonly actions: readonly ActionResult[];
  readonly response: string;
  readonly policy?: PolicyDecision;
};

export interface RuntimeOrchestratorDependencies {
  readonly identity: IdentityRuntime;
  readonly context: ContextRuntime;
  readonly decision: DecisionRuntime;
  readonly policy: PolicyRuntime;
  readonly action: ActionRuntime;
  readonly workflow?: WorkflowRuntime;
  readonly memory?: MemoryRuntime;
  readonly observability?: RuntimeExecutionObservability;
}

/** The only governed request cycle used by new OIP transports. */
export class RuntimeOrchestrator {
  constructor(private readonly dependencies: RuntimeOrchestratorDependencies) {}

  async handle(request: InboundRequest, interpreter: IntentInterpreter): Promise<RuntimeOutcome> {
    const startedAtMs = Date.now();
    const startedAt = new Date(startedAtMs).toISOString();
    try {
      const outcome = await this.handleInternal(request, interpreter);
      await this.dependencies.observability?.record({
        requestId: outcome.context.requestId,
        organizationId: outcome.context.identity.organizationId,
        userId: outcome.context.identity.userId,
        status: outcome.status,
        startedAt,
        durationMs: Date.now() - startedAtMs,
        intention: outcome.intention,
        decisionType: outcome.decision.type,
        ...(outcome.decision.type === "plan" ? {
          planId: outcome.decision.plan.planId,
          ...(outcome.decision.plan.agentId !== undefined ? { agentId: outcome.decision.plan.agentId } : {}),
        } : {}),
        actionCapabilityIds: outcome.actions.map((action) => action.capabilityId),
      });
      return outcome;
    } catch (error) {
      await this.dependencies.observability?.record({
        requestId: request.metadata?.["requestId"]?.toString() ?? "unknown",
        status: "error",
        startedAt,
        durationMs: Date.now() - startedAtMs,
        actionCapabilityIds: [],
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  private async handleInternal(request: InboundRequest, interpreter: IntentInterpreter): Promise<RuntimeOutcome> {
    const identity = await this.dependencies.identity.authenticate(request);
    const context = await this.dependencies.context.build(request, identity);
    const intention = await interpreter.interpret(request, context);
    const decision = await this.dependencies.decision.decide(intention, context);

    if (decision.type === "clarify") {
      return { status: "clarification_required", context, intention, decision, actions: [], response: decision.question };
    }

    if (decision.type === "reject") {
      return { status: "rejected", context, intention, decision, actions: [], response: decision.reason };
    }

    const actions: ActionResult[] = [];
    for (const step of decision.plan.steps) {
      if (step.type === "workflow") {
        if (!step.workflowId || !this.dependencies.workflow) {
          return { status: "rejected", context, intention, decision, actions, response: "Workflow execution is not configured." };
        }
        const policy = await this.dependencies.policy.evaluate({
          subject: context.identity,
          resource: step.workflowId,
          action: "start",
          arguments: step.arguments,
        }, context);
        if (policy.effect !== "allow") {
          return {
            status: policy.effect === "confirm" ? "confirmation_required" : "rejected",
            context, intention, decision, actions, policy,
            response: policy.effect === "confirm"
              ? "A trusted confirmation is required before this workflow can be started."
              : policy.reasons.join(" ") || "The workflow was rejected by policy.",
          };
        }
        const execution = await this.dependencies.workflow.start(step.workflowId, step.arguments, context);
        if (execution.status === "failed") {
          return { status: "rejected", context, intention, decision, actions, response: "The workflow failed during execution." };
        }
        continue;
      }

      if (step.type !== "action" || !step.capabilityId) {
        return { status: "rejected", context, intention, decision, actions, response: `Unsupported execution step: ${step.type}.` };
      }

      const policy = await this.dependencies.policy.evaluate({
        subject: context.identity,
        resource: step.capabilityId,
        action: "execute",
        arguments: step.arguments,
      }, context);

      if (policy.effect === "confirm") {
        return {
          status: "confirmation_required", context, intention, decision, actions, policy,
          response: "A trusted confirmation is required before this action can be executed.",
        };
      }
      if (policy.effect !== "allow") {
        return {
          status: "rejected", context, intention, decision, actions, policy,
          response: policy.reasons.join(" ") || "The action was rejected by policy.",
        };
      }

      const result = await this.dependencies.action.execute({
        capabilityId: step.capabilityId,
        arguments: step.arguments,
        confidence: intention.confidence,
        reason: decision.plan.explanation,
      }, context);
      actions.push(result);
      if (result.status !== "completed") {
        await this.remember(request, context, "The action was rejected during execution.");
        return { status: "rejected", context, intention, decision, actions, response: "The action was rejected during execution." };
      }
    }

    const response = "Action executed successfully.";
    await this.remember(request, context, response);
    return { status: "completed", context, intention, decision, actions, response };
  }

  private async remember(request: InboundRequest, context: ExecutionContext, response: string): Promise<void> {
    if (!this.dependencies.memory || !request.text) return;
    await this.dependencies.memory.append({
      id: `${context.requestId}-conversation`,
      type: "conversation",
      workspaceId: context.identity.organizationId,
      userId: context.identity.userId,
      ...(context.threadId !== undefined ? { threadId: context.threadId } : {}),
      content: JSON.stringify({ input: request.text, response }),
      occurredAt: new Date().toISOString(),
      metadata: { channel: context.channel },
    });
  }
}
