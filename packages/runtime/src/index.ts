import {
  ActionEngine,
  CapabilityRegistry,
  ToolRegistry,
  Validator,
  type PlannedAction,
  type RuntimeContext,
} from "../../core/src/index.js";
import { InMemoryObservabilityAdapter } from "../../adapters/src/index.js";
import { InMemoryAuditLog } from "../../audit-log/src/index.js";
import { ContextBuilder, type BuiltContext } from "../../context-builder/src/index.js";
import { InMemoryEventBus } from "../../event-bus/src/index.js";
import { KnowledgeEngine } from "../../knowledge-engine/src/index.js";
import type { LlmAdapter } from "../../llm-adapter/src/index.js";
import { InMemoryStore } from "../../memory/src/index.js";
import { DocumentService } from "../../document-service/src/index.js";
import { MutableKnowledgeSource } from "../../knowledge-engine/src/index.js";
import { LlmPlanner } from "../../planner/src/index.js";
import { installPluginModule, type OipPluginModule } from "../../plugin-sdk/src/index.js";
import { WorkflowEngine, WorkflowRegistry } from "../../workflow-engine/src/index.js";

export class OipRuntime {
  readonly capabilities = new CapabilityRegistry();
  readonly tools = new ToolRegistry();
  readonly workflows = new WorkflowRegistry();
  readonly knowledge = new KnowledgeEngine();
  readonly documentKnowledge = new MutableKnowledgeSource("documents", "Documents");
  readonly documents = new DocumentService(this.documentKnowledge);
  readonly memory = new InMemoryStore();
  readonly observability = new InMemoryObservabilityAdapter();
  readonly events = new InMemoryEventBus();
  readonly audit = new InMemoryAuditLog();
  readonly actions = new ActionEngine(this.capabilities, this.tools, new Validator(), this.events, this.audit);
  readonly workflowEngine = new WorkflowEngine(this.workflows, this.actions);
  readonly contextBuilder = new ContextBuilder(this.knowledge, this.memory);

  constructor() {
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
