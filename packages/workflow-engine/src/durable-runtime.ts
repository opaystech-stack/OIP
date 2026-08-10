import type {
  DomainEvent,
  EventRuntime,
  ExecutionContext,
  JsonObject,
  WorkflowDefinition,
  WorkflowExecution,
  WorkflowExecutionStore,
  WorkflowRuntime,
  WorkflowSignal,
} from "../../core/src/contracts/index.js";
import type { AuditLogger } from "../../core/src/types.js";

export interface DurableWorkflowHandler {
  start(args: JsonObject, context: ExecutionContext, execution: WorkflowExecution): Promise<WorkflowExecution>;
  resume?(execution: WorkflowExecution, context: ExecutionContext): Promise<WorkflowExecution>;
  compensate?(execution: WorkflowExecution, context: ExecutionContext): Promise<WorkflowExecution>;
  signal?(execution: WorkflowExecution, signal: WorkflowSignal, context: ExecutionContext): Promise<WorkflowExecution>;
}

export class DurableWorkflowRegistry {
  private readonly workflows = new Map<string, { definition: WorkflowDefinition; handler: DurableWorkflowHandler }>();

  register(definition: WorkflowDefinition, handler: DurableWorkflowHandler): void {
    if (this.workflows.has(definition.id)) throw new Error(`Workflow already registered: ${definition.id}`);
    this.workflows.set(definition.id, { definition, handler });
  }

  get(workflowId: string): { definition: WorkflowDefinition; handler: DurableWorkflowHandler } | undefined {
    return this.workflows.get(workflowId);
  }

  list(): readonly WorkflowDefinition[] {
    return [...this.workflows.values()].map((workflow) => workflow.definition);
  }
}

export class InMemoryWorkflowExecutionStore implements WorkflowExecutionStore {
  private readonly executions = new Map<string, WorkflowExecution>();
  async save(execution: WorkflowExecution): Promise<void> { this.executions.set(execution.executionId, execution); }
  async load(executionId: string): Promise<WorkflowExecution | undefined> { return this.executions.get(executionId); }
  async list(workflowId?: string): Promise<readonly WorkflowExecution[]> {
    return [...this.executions.values()].filter((execution) => !workflowId || execution.workflowId === workflowId);
  }
}

/**
 * Durable workflow contract implementation. A production store can be injected
 * without changing handlers, policy, plugins or the canonical runtime.
 */
export class DurableWorkflowRuntime implements WorkflowRuntime {
  constructor(
    private readonly registry: DurableWorkflowRegistry,
    private readonly store: WorkflowExecutionStore,
    private readonly events?: EventRuntime,
    private readonly audit?: AuditLogger,
  ) {}

  async start(workflowId: string, args: Record<string, unknown>, context: ExecutionContext): Promise<WorkflowExecution> {
    const workflow = this.requireWorkflow(workflowId);
    const initial: WorkflowExecution = {
      executionId: crypto.randomUUID(),
      workflowId,
      status: "running",
      steps: [],
      updatedAt: new Date().toISOString(),
    };
    await this.persist(initial, context, "workflow.started");
    const result = await workflow.handler.start(args as JsonObject, context, initial);
    return this.persist(result, context, `workflow.${result.status}`);
  }

  async resume(executionId: string, context: ExecutionContext): Promise<WorkflowExecution> {
    const execution = await this.requireExecution(executionId);
    const handler = this.requireWorkflow(execution.workflowId).handler;
    if (!handler.resume) throw new Error(`Workflow ${execution.workflowId} is not resumable.`);
    const result = await handler.resume(execution, context);
    return this.persist(result, context, `workflow.${result.status}`);
  }

  async compensate(executionId: string, context: ExecutionContext): Promise<WorkflowExecution> {
    const execution = await this.requireExecution(executionId);
    const handler = this.requireWorkflow(execution.workflowId).handler;
    if (!handler.compensate) throw new Error(`Workflow ${execution.workflowId} is not compensable.`);
    const compensating = { ...execution, status: "compensating" as const, updatedAt: new Date().toISOString() };
    await this.persist(compensating, context, "workflow.compensating");
    const result = await handler.compensate(compensating, context);
    return this.persist(result, context, `workflow.${result.status}`);
  }

  async signal(executionId: string, signal: WorkflowSignal): Promise<void> {
    const execution = await this.requireExecution(executionId);
    const workflow = this.requireWorkflow(execution.workflowId);
    if (!workflow.handler.signal) throw new Error(`Workflow ${execution.workflowId} does not accept signals.`);
    const context: ExecutionContext = {
      requestId: `workflow-signal-${executionId}`,
      identity: { userId: "workflow", organizationId: "workflow", roles: [] },
      channel: "api",
    };
    const result = await workflow.handler.signal(execution, signal, context);
    await this.persist(result, context, `workflow.signal.${signal.type}`);
  }

  getState(executionId: string): Promise<WorkflowExecution> { return this.requireExecution(executionId); }
  async listDefinitions(_context: ExecutionContext): Promise<readonly WorkflowDefinition[]> { return this.registry.list(); }

  private async persist(execution: WorkflowExecution, context: ExecutionContext, eventType: string): Promise<WorkflowExecution> {
    const updated = { ...execution, updatedAt: new Date().toISOString() };
    await this.store.save(updated);
    const event: DomainEvent = {
      type: eventType,
      payload: { executionId: updated.executionId, workflowId: updated.workflowId, status: updated.status },
      occurredAt: updated.updatedAt,
    };
    await this.events?.publish(event);
    await this.audit?.record({
      requestId: context.requestId,
      organizationId: context.identity.organizationId,
      userId: context.identity.userId,
      capabilityId: updated.workflowId,
      status: updated.status === "completed" || updated.status === "compensated" ? "completed" : "rejected",
      reason: eventType,
      occurredAt: updated.updatedAt,
    });
    return updated;
  }

  private requireWorkflow(workflowId: string) {
    const workflow = this.registry.get(workflowId);
    if (!workflow) throw new Error(`Unknown workflow: ${workflowId}`);
    return workflow;
  }

  private async requireExecution(executionId: string): Promise<WorkflowExecution> {
    const execution = await this.store.load(executionId);
    if (!execution) throw new Error(`Unknown workflow execution: ${executionId}`);
    return execution;
  }
}
