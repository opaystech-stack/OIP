import {
  ActionEngine,
  type AuditLogger,
  CapabilityRegistry,
  type EventPublisher,
  ToolRegistry,
  Validator,
  type PlannedAction,
  type RuntimeContext,
} from "../../core/src/index.js";
import { InMemoryObservabilityAdapter } from "../../adapters/src/index.js";
import type { VectorAdapter } from "../../adapters/src/index.js";
import { InMemoryAuditLog } from "../../audit-log/src/index.js";
import { ContextBuilder, type BuiltContext } from "../../context-builder/src/index.js";
import { InMemoryEventBus } from "../../event-bus/src/index.js";
import { KnowledgeEngine } from "../../knowledge-engine/src/index.js";
import type { LlmAdapter } from "../../llm-adapter/src/index.js";
import { InMemoryStore } from "../../memory/src/index.js";
import type { MemoryStore } from "../../memory/src/index.js";
import { DocumentService } from "../../document-service/src/index.js";
import { MutableKnowledgeSource } from "../../knowledge-engine/src/index.js";
import { LlmPlanner } from "../../planner/src/index.js";
import { installPluginModule, type OipPluginModule } from "../../plugin-sdk/src/index.js";
import { WorkflowEngine, WorkflowRegistry } from "../../workflow-engine/src/index.js";

export class OipRuntime {
  readonly capabilities = new CapabilityRegistry();
  readonly tools = new ToolRegistry();
  readonly workflows = new WorkflowRegistry();
  readonly knowledge: KnowledgeEngine;
  readonly documentKnowledge = new MutableKnowledgeSource("documents", "Documents");
  readonly documents = new DocumentService(this.documentKnowledge);
  readonly memory: MemoryStore;
  readonly observability = new InMemoryObservabilityAdapter();
  readonly events: EventPublisher & { list?: () => unknown };
  readonly audit: AuditLogger & { list?: () => unknown };
  readonly actions: ActionEngine;
  readonly workflowEngine: WorkflowEngine;
  readonly contextBuilder: ContextBuilder;

  constructor(options: OipRuntimeOptions = {}) {
    this.knowledge = new KnowledgeEngine(options.vector);
    this.memory = options.memory ?? new InMemoryStore();
    this.events = options.events ?? new InMemoryEventBus();
    this.audit = options.audit ?? new InMemoryAuditLog();
    this.actions = new ActionEngine(this.capabilities, this.tools, new Validator(), this.events, this.audit);
    this.workflowEngine = new WorkflowEngine(this.workflows, this.actions);
    this.contextBuilder = new ContextBuilder(this.knowledge, this.memory);
    this.knowledge.register(this.documentKnowledge);
  }

  use(module: OipPluginModule): this {
    installPluginModule(module, {
      capabilities: this.capabilities,
      tools: this.tools,
      workflows: this.workflows,
    });

    return this;
  }

  createPlanner(llm: LlmAdapter): LlmPlanner {
    return new LlmPlanner(llm, this.capabilities.list());
  }

  buildContext(input: string, context: RuntimeContext): Promise<BuiltContext> {
    return this.contextBuilder.build(input, context);
  }

  execute(plan: PlannedAction, context: RuntimeContext) {
    return this.actions.execute(plan, context);
  }
}

export interface OipRuntimeOptions {
  readonly memory?: MemoryStore;
  readonly events?: EventPublisher & { list?: () => unknown };
  readonly audit?: AuditLogger & { list?: () => unknown };
  readonly vector?: VectorAdapter;
}
