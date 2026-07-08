import {
  ActionEngine,
  CapabilityRegistry,
  ToolRegistry,
  Validator,
} from "../../core/src/index.js";
import type {
  ActionRuntime,
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
import { WorkflowRegistry } from "../../workflow-engine/src/index.js";
import { installPluginModule, type OipPluginModule } from "../../plugin-sdk/src/index.js";

export class ComposedRuntime {
  readonly capabilities = new CapabilityRegistry();
  readonly tools = new ToolRegistry();
  readonly workflows = new WorkflowRegistry();
  readonly actions: ActionEngine;

  constructor(
    private readonly options: Required<RuntimeBuilderOptions>,
  ) {
    this.actions = new ActionEngine(this.capabilities, this.tools, new Validator(), {
      publish: async (event) => this.options.event.publish(event),
    }, {
      record: async () => Promise.resolve(),
    });
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
    return this.options.identity.authenticate(request);
  }

  async buildContext(request: InboundRequest): Promise<ExecutionContext> {
    const identity = await this.authenticate(request);
    return this.options.context.build(request, identity);
  }

  async decide(intent: Intention, context: ExecutionContext): Promise<import("../../core/src/contracts/index.js").DecisionResult> {
    return this.options.decision.decide(intent, context);
  }

  async execute(action: PlannedAction, context: ExecutionContext) {
    return this.actions.execute(action, context as unknown as import("../../core/src/types.js").RuntimeContext);
  }

  get event(): EventRuntime {
    return this.options.event;
  }

  get identity(): IdentityRuntime {
    return this.options.identity;
  }

  get context(): ContextRuntime {
    return this.options.context;
  }

  get memory(): MemoryRuntime {
    return this.options.memory;
  }

  get knowledge(): KnowledgeRuntime {
    return this.options.knowledge;
  }

  get llm(): LlmRuntime {
    return this.options.llm;
  }

  get decision(): DecisionRuntime {
    return this.options.decision;
  }

  get policy(): PolicyRuntime {
    return this.options.policy;
  }

  get workflow(): WorkflowRuntime {
    return this.options.workflow;
  }

  get skill(): SkillRuntime {
    return this.options.skill;
  }

  get observability(): ObservabilityRuntime {
    return this.options.observability;
  }
}

export type {
  ActionRuntime,
  ContextRuntime,
  DecisionRuntime,
  EventRuntime,
  IdentityRuntime,
  KnowledgeRuntime,
  LlmRuntime,
  MemoryRuntime,
  ObservabilityRuntime,
  PolicyRuntime,
  RuntimeBuilderOptions,
  SkillRuntime,
  WorkflowRuntime,
} from "../../core/src/contracts/index.js";
