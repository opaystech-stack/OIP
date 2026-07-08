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
import type { AutomationAdapter, McpAdapter, VectorAdapter } from "../../adapters/src/index.js";
import { InMemoryAuditLog } from "../../audit-log/src/index.js";
import type { BuiltContext } from "../../context-builder/src/index.js";
import { InMemoryMemoryRuntime, LegacyMemoryRuntimeAdapter, MemoryRuntimeStoreAdapter } from "../../memory-runtime/src/index.js";
import { InMemoryEventRuntime, EventRuntimePublisherAdapter } from "../../event-runtime/src/index.js";
import { InMemoryContextRuntime, ContextRuntimeBuilderAdapter } from "../../context-runtime/src/index.js";
import { KnowledgeEngine } from "../../knowledge-engine/src/index.js";
import type { LlmAdapter } from "../../llm-adapter/src/index.js";
import type { MemoryStore } from "../../memory/src/index.js";
import { DocumentService } from "../../document-service/src/index.js";
import { MutableKnowledgeSource } from "../../knowledge-engine/src/index.js";
import type { DocumentAdapter, OcrAdapter } from "../../adapters/src/index.js";
import { LlmBasedDecisionRuntime, type Planner } from "../../decision-runtime/src/llm.js";
import { installPluginModule, type OipPluginModule } from "../../plugin-sdk/src/index.js";
import { WorkflowEngine, WorkflowRegistry } from "../../workflow-engine/src/index.js";
import { InMemoryAutomationAdapter, InMemoryMcpAdapter } from "../../integration-adapters/src/index.js";

export class OipRuntime {
  readonly capabilities = new CapabilityRegistry();
  readonly tools = new ToolRegistry();
  readonly workflows = new WorkflowRegistry();
  readonly knowledge: KnowledgeEngine;
  readonly documentKnowledge = new MutableKnowledgeSource("documents", "Documents");
  readonly documents: DocumentService;
  readonly memory: MemoryStore;
  readonly observability = new InMemoryObservabilityAdapter();
  readonly automation: AutomationAdapter;
  readonly mcp: McpAdapter;
  readonly events: EventPublisher & { list?: () => unknown };
  readonly audit: AuditLogger & { list?: () => unknown };
  readonly actions: ActionEngine;
  readonly workflowEngine: WorkflowEngine;
  readonly contextBuilder: import("../../context-runtime/src/adapter.js").ContextRuntimeBuilderAdapter;

  constructor(options: OipRuntimeOptions = {}) {
    this.knowledge = new KnowledgeEngine(options.vector);
    const memoryRuntime = options.memory
      ? new LegacyMemoryRuntimeAdapter(options.memory)
      : new InMemoryMemoryRuntime();
    this.memory = options.memory ?? new MemoryRuntimeStoreAdapter(memoryRuntime);
    this.automation = options.automation ?? new InMemoryAutomationAdapter();
    this.mcp = options.mcp ?? new InMemoryMcpAdapter();
    this.events = options.events ?? new EventRuntimePublisherAdapter(new InMemoryEventRuntime());
    this.audit = options.audit ?? new InMemoryAuditLog();
    this.documents = new DocumentService(this.documentKnowledge, 800, options.documentParser, options.ocr);
    this.actions = new ActionEngine(this.capabilities, this.tools, new Validator(), this.events, this.audit);
    this.workflowEngine = new WorkflowEngine(this.workflows, this.actions);
    this.contextBuilder = new ContextRuntimeBuilderAdapter(
      new InMemoryContextRuntime(
        memoryRuntime,
        undefined,
      ),
    );
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

  createPlanner(llm: LlmAdapter): Planner {
    return new LlmBasedDecisionRuntime(llm, this.capabilities.list());
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
  readonly documentParser?: DocumentAdapter;
  readonly ocr?: OcrAdapter;
  readonly automation?: AutomationAdapter;
  readonly mcp?: McpAdapter;
}

// Re-export public core helpers and types for the single-package developer experience.
export {
  defineCapability,
  defineTool,
  success,
  rejected,
  ActionEngine,
  CapabilityRegistry,
  ToolRegistry,
  Validator,
  registerPlugin,
  type ActionResult,
  type CapabilityDefinition,
  type CapabilityParameter,
  type ConfirmationLevel,
  type DomainEvent,
  type JsonObject,
  type JsonValue,
  type OipPlugin,
  type PlannedAction,
  type RuntimeContext,
  type ToolHandler,
  type UserContext,
  type ValidationIssue,
  type ValidationResult,
} from "../../core/src/index.js";

export {
  definePlugin,
  definePluginModule,
  installPluginModule,
  type OipPluginModule,
} from "../../plugin-sdk/src/index.js";

export { createRuntimeFromEnv } from "../../runtime/src/factory.js";
export { MockLlmAdapter, OpenAiCompatibleLlmAdapter } from "../../llm-adapter/src/index.js";
