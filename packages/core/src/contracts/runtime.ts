import type { ExecutionContext } from "./context.js";
import type { DomainEvent, EventFilter, EventHandler, EventSubscription } from "./event.js";
import type { InboundRequest, OutboundResponse } from "./channel.js";
import type { IngestionResult, KnowledgeQuery, KnowledgeResult, KnowledgeSource } from "./knowledge.js";
import type { DecisionResult, ExecutionPlan, PlannedAction } from "./plan.js";
import type { Intention } from "./intention.js";
import type { ActionResult, ToolHandler } from "./action.js";
import type { IdentityContext, Workspace } from "./identity.js";
import type { MemoryEntry, MemoryQuery, MemoryResult } from "./memory.js";
import type { PolicyDecision, PolicyDefinition, PolicyRequest } from "./policy.js";
import type { SkillDefinition, SkillInput, SkillResult } from "./skill.js";
import type { WorkflowDefinition, WorkflowExecution, WorkflowSignal } from "./workflow.js";

export interface ChannelRuntime {
  receive(request: InboundRequest): Promise<InboundRequest>;
  send(response: OutboundResponse): Promise<void>;
}

export interface IdentityRuntime {
  authenticate(request: InboundRequest): Promise<IdentityContext>;
  resolveWorkspace(identity: IdentityContext): Promise<Workspace>;
}

export interface ContextRuntime {
  build(request: InboundRequest, identity: IdentityContext): Promise<ExecutionContext>;
}

export interface LlmRuntime {
  generateText(messages: readonly unknown[], options?: unknown): Promise<string>;
  generateJson<T>(messages: readonly unknown[], schema: unknown): Promise<T>;
  embed(text: string): Promise<readonly number[]>;
}

export interface DecisionRuntime {
  decide(intent: Intention, context: ExecutionContext): Promise<DecisionResult>;
}

export interface PolicyRuntime {
  evaluate(request: PolicyRequest, context: ExecutionContext): Promise<PolicyDecision>;
  registerPolicy(policy: PolicyDefinition): Promise<void>;
}

export interface WorkflowRuntime {
  start(workflowId: string, args: Record<string, unknown>, context: ExecutionContext): Promise<WorkflowExecution>;
  signal(executionId: string, signal: WorkflowSignal): Promise<void>;
  getState(executionId: string): Promise<WorkflowExecution>;
  listDefinitions(context: ExecutionContext): Promise<readonly WorkflowDefinition[]>;
}

export interface ActionRuntime {
  execute(action: PlannedAction, context: ExecutionContext): Promise<ActionResult>;
}

export interface MemoryRuntime {
  append(entry: MemoryEntry): Promise<void>;
  recall(query: MemoryQuery): Promise<readonly MemoryResult[]>;
}

export interface KnowledgeRuntime {
  registerSource(source: KnowledgeSource): Promise<void>;
  ingest(sourceId: string, document: unknown): Promise<IngestionResult>;
  search(query: KnowledgeQuery): Promise<readonly KnowledgeResult[]>;
}

export interface EventRuntime {
  publish(event: DomainEvent): Promise<void>;
  subscribe(filter: EventFilter, handler: EventHandler): Promise<EventSubscription>;
}

export interface SkillRuntime {
  invoke(input: SkillInput, context: ExecutionContext): Promise<SkillResult>;
  list(context: ExecutionContext): Promise<readonly SkillDefinition[]>;
}

export interface ObservabilityRuntime {
  trace<T>(name: string, operation: () => Promise<T>): Promise<T>;
  log(event: DomainEvent): Promise<void>;
}

export interface RuntimeBuilderOptions {
  readonly channel?: ChannelRuntime;
  readonly identity?: IdentityRuntime;
  readonly context?: ContextRuntime;
  readonly llm?: LlmRuntime;
  readonly decision?: DecisionRuntime;
  readonly policy?: PolicyRuntime;
  readonly workflow?: WorkflowRuntime;
  readonly action?: ActionRuntime;
  readonly memory?: MemoryRuntime;
  readonly knowledge?: KnowledgeRuntime;
  readonly event?: EventRuntime;
  readonly skill?: SkillRuntime;
  readonly observability?: ObservabilityRuntime;
}

export interface CapabilityRegistry {
  register(capability: unknown, handler: ToolHandler): void;
  list(context?: ExecutionContext): readonly unknown[];
  get(id: string): { capability: unknown; handler: ToolHandler } | undefined;
}
