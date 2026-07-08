import {
  ActionEngine,
  CapabilityRegistry,
  ToolRegistry,
  Validator,
} from "../../core/src/index.js";
import type {
  ActionRuntime,
  ChannelRuntime,
  ContextRuntime,
  DecisionRuntime,
  EventRuntime,
  ExecutionContext,
  IdentityRuntime,
  InboundRequest,
  Intention,
  KnowledgeRuntime,
  LlmRuntime,
  MemoryRuntime,
  ObservabilityRuntime,
  PlannedAction,
  PolicyRuntime,
  RuntimeBuilderOptions,
  SkillRuntime,
  WorkflowRuntime,
} from "../../core/src/contracts/index.js";
import { EventRuntimePublisherAdapter } from "../../event-runtime/src/index.js";
import { InMemoryAuditLog } from "../../audit-log/src/index.js";
import { WorkflowRegistry } from "../../workflow-engine/src/index.js";
import { installPluginModule, type OipPluginModule } from "../../plugin-sdk/src/index.js";
import { ActionEngineRuntime } from "../../action-runtime/src/index.js";
import { RuleBasedDecisionRuntime } from "../../decision-runtime/src/index.js";

export class ComposedRuntime {
  readonly capabilities = new CapabilityRegistry();
  readonly tools = new ToolRegistry();
  readonly workflows = new WorkflowRegistry();
  readonly actions: ActionEngineRuntime;

  constructor(private readonly runtimes: Partial<RuntimeBuilderOptions> = {}) {
    const eventPublisher = new EventRuntimePublisherAdapter(
      this.runtimes.event ?? {
        publish: async () => Promise.resolve(),
        subscribe: async () => ({ unsubscribe: () => {} }),
      },
    );
    this.actions = new ActionEngineRuntime(this.capabilities, this.tools, eventPublisher, new InMemoryAuditLog());
  }

  use(module: OipPluginModule): this {
    installPluginModule(module, {
      capabilities: this.capabilities,
      tools: this.tools,
      workflows: this.workflows,
    });
    return this;
  }

  async authenticate(request: InboundRequest): Promise<import("../../core/src/contracts/index.js").IdentityContext> {
    return this.runtimes.identity?.authenticate(request) ?? {
      userId: "anonymous",
      organizationId: "default",
      roles: [],
    };
  }

  async buildContext(request: InboundRequest): Promise<ExecutionContext> {
    const identity = await this.authenticate(request);
    return this.runtimes.context?.build(request, identity) ?? {
      requestId: request.metadata?.["requestId"]?.toString() ?? crypto.randomUUID(),
      identity,
      channel: request.channel,
    };
  }

  async decide(intent: Intention, context: ExecutionContext): Promise<import("../../core/src/contracts/index.js").DecisionResult> {
    const decisionRuntime = this.runtimes.decision ?? new RuleBasedDecisionRuntime(this.capabilities.list());
    return decisionRuntime.decide(intent, context);
  }

  async execute(action: PlannedAction, context: ExecutionContext) {
    return this.actions.execute(action, context);
  }

  get channel(): ChannelRuntime | undefined {
    return this.runtimes.channel;
  }

  get identity(): IdentityRuntime | undefined {
    return this.runtimes.identity;
  }

  get context(): ContextRuntime | undefined {
    return this.runtimes.context;
  }

  get memory(): MemoryRuntime | undefined {
    return this.runtimes.memory;
  }

  get knowledge(): KnowledgeRuntime | undefined {
    return this.runtimes.knowledge;
  }

  get llm(): LlmRuntime | undefined {
    return this.runtimes.llm;
  }

  get decision(): DecisionRuntime | undefined {
    return this.runtimes.decision;
  }

  get policy(): PolicyRuntime | undefined {
    return this.runtimes.policy;
  }

  get workflow(): WorkflowRuntime | undefined {
    return this.runtimes.workflow;
  }

  get skill(): SkillRuntime | undefined {
    return this.runtimes.skill;
  }

  get observability(): ObservabilityRuntime | undefined {
    return this.runtimes.observability;
  }
}

export type {
  ActionRuntime,
  ChannelRuntime,
  ContextRuntime,
  DecisionRuntime,
  EventRuntime,
  IdentityRuntime,
  KnowledgeRuntime,
  LlmRuntime,
  MemoryRuntime,
  ObservabilityRuntime,
  PlannedAction,
  PolicyRuntime,
  RuntimeBuilderOptions,
  SkillRuntime,
  WorkflowRuntime,
} from "../../core/src/contracts/index.js";
