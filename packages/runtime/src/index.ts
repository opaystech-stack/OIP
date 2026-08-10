import {
  ActionEngine,
  type AuditLogger,
  CapabilityRegistry,
  type EventPublisher,
  ToolRegistry,
  type ToolHandler,
  Validator,
  type PlannedAction,
  type RuntimeContext,
} from "../../core/src/index.js";
import { InMemoryObservabilityAdapter } from "../../adapters/src/index.js";
import type { AutomationAdapter, McpAdapter, VectorAdapter } from "../../adapters/src/index.js";
import { InMemoryAuditLog } from "../../audit-log/src/index.js";
import type { BuiltContext } from "../../context-builder/src/index.js";
import {
  InMemoryMemoryRuntime,
  LegacyMemoryRuntimeAdapter,
  MemoryRuntimeStoreAdapter,
  TanStackMemoryRuntime,
} from "../../memory-runtime/src/index.js";
import type { MemoryAdapter } from "../../memory-runtime/src/index.js";
import { InMemoryEventRuntime, EventRuntimePublisherAdapter } from "../../event-runtime/src/index.js";
import { InMemoryContextRuntime, ContextRuntimeBuilderAdapter } from "../../context-runtime/src/index.js";
import { KnowledgeEngine } from "../../knowledge-engine/src/index.js";
import { KnowledgeEngineRuntime } from "../../knowledge-runtime/src/index.js";
import type { LlmAdapter } from "../../llm-adapter/src/index.js";
import type { MemoryStore } from "../../memory/src/index.js";
import { DocumentService } from "../../document-service/src/index.js";
import { MutableKnowledgeSource } from "../../knowledge-engine/src/index.js";
import type { DocumentAdapter, OcrAdapter } from "../../adapters/src/index.js";
import { LlmBasedDecisionRuntime, type Planner } from "../../decision-runtime/src/llm.js";
import { installPluginModule, type OipPluginModule } from "../../plugin-sdk/src/index.js";
import { WorkflowEngine, WorkflowRegistry } from "../../workflow-engine/src/index.js";
import { InMemoryAutomationAdapter, InMemoryMcpAdapter } from "../../integration-adapters/src/index.js";
import { ActionEngineRuntime } from "../../action-runtime/src/index.js";
import { ProviderRegistry } from "../../llm-runtime/src/index.js";
import { InMemoryPolicyRuntime } from "../../policy-runtime/src/index.js";
import { DecisionEngine } from "../../decision-runtime/src/index.js";
import type { DecisionRuntime, IdentityRuntime, InboundRequest, MemoryRuntime, PolicyRuntime, WorkflowRuntime } from "../../core/src/contracts/index.js";
import {
  CapabilityGateway,
  type CapabilityDescriptor,
  type CapabilityGatewayAuditRecord,
} from "../../capability-gateway/src/index.js";
import { RuntimeOrchestrator, type IntentInterpreter, type RuntimeOutcome } from "./orchestrator.js";
import { AgentRegistry } from "./agent-registry.js";
import { InMemoryRuntimeExecutionObservability } from "./observability.js";

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
  readonly capabilityGateway: CapabilityGateway;
  readonly workflowEngine: WorkflowEngine;
  readonly contextBuilder: import("../../context-runtime/src/adapter.js").ContextRuntimeBuilderAdapter;
  readonly policy: PolicyRuntime;
  readonly providers = new ProviderRegistry();
  readonly agents = new AgentRegistry();
  readonly executionObservability = new InMemoryRuntimeExecutionObservability();
  private readonly orchestrator: RuntimeOrchestrator;

  constructor(options: OipRuntimeOptions = {}) {
    this.knowledge = new KnowledgeEngine(options.vector);
    if (options.memoryAdapter !== undefined && (options.memory !== undefined || options.memoryRuntime !== undefined)) {
      throw new Error("OipRuntime memoryAdapter cannot be combined with memory or memoryRuntime.");
    }
    const memoryRuntime = options.memoryRuntime
      ?? (options.memoryAdapter !== undefined
        ? new TanStackMemoryRuntime(
          options.memoryAdapter,
          options.memoryNamespace !== undefined ? { namespace: options.memoryNamespace } : {},
        )
        : (options.memory
          ? new LegacyMemoryRuntimeAdapter(options.memory)
          : new InMemoryMemoryRuntime()));
    this.memory = options.memory ?? new MemoryRuntimeStoreAdapter(memoryRuntime);
    this.automation = options.automation ?? new InMemoryAutomationAdapter();
    this.mcp = options.mcp ?? new InMemoryMcpAdapter();
    this.events = options.events ?? new EventRuntimePublisherAdapter(new InMemoryEventRuntime());
    this.audit = options.audit ?? new InMemoryAuditLog();
    this.documents = new DocumentService(this.documentKnowledge, 800, options.documentParser, options.ocr);
    this.actions = new ActionEngine(this.capabilities, this.tools, new Validator(), this.events, this.audit);
    this.workflowEngine = new WorkflowEngine(this.workflows, this.actions);
    this.policy = options.policy ?? new InMemoryPolicyRuntime();
    const actionRuntime = new ActionEngineRuntime(this.capabilities, this.tools, this.events, this.audit);
    this.capabilityGateway = new CapabilityGateway({
      action: actionRuntime,
      policy: this.policy,
      audit: {
        record: async (entry: CapabilityGatewayAuditRecord) => this.audit.record({
          requestId: entry.requestId,
          organizationId: entry.organizationId,
          userId: entry.userId,
          capabilityId: entry.capabilityId ?? "oip.capability.gateway",
          status: entry.outcome === "completed" ? "completed" : "rejected",
          reason: entry.reason,
          occurredAt: entry.occurredAt,
          metadata: {
            query: entry.query,
            outcome: entry.outcome,
            ...(entry.metadata ?? {}),
          },
        }),
      },
    });
    const contextRuntime = new InMemoryContextRuntime(memoryRuntime, new KnowledgeEngineRuntime(this.knowledge, this.documents));
    this.contextBuilder = new ContextRuntimeBuilderAdapter(contextRuntime);
    const decision: DecisionRuntime = options.decision ?? {
      decide: async (intention, context) => new DecisionEngine(() => this.capabilities.list(), this.agents).decide(intention, context),
    };
    this.orchestrator = new RuntimeOrchestrator({
      identity: options.identity ?? missingIdentityRuntime(),
      context: contextRuntime,
      decision,
      policy: this.policy,
      action: actionRuntime,
      ...(options.workflow !== undefined ? { workflow: options.workflow } : {}),
      memory: memoryRuntime,
      observability: this.executionObservability,
    });
    this.knowledge.register(this.documentKnowledge);
  }

  use(module: OipPluginModule): this {
    installPluginModule(module, {
      capabilities: this.capabilities,
      tools: this.tools,
      workflows: this.workflows,
    });

    for (const capability of module.plugin.capabilities) {
      void this.policy.registerPolicy({
        id: `capability:${capability.id}`,
        description: `Execution policy for ${capability.id}.`,
        resource: capability.id,
        action: "execute",
        rules: [{ rolesAll: [...capability.requiredRoles], confirmationLevel: capability.confirmationLevel }],
      });
    }
    for (const workflow of module.workflows ?? []) {
      void this.policy.registerPolicy({
        id: `workflow:${workflow.definition.id}`,
        description: `Start policy for ${workflow.definition.id}.`,
        resource: workflow.definition.id,
        action: "start",
        rules: [{ rolesAll: [...workflow.definition.requiredRoles] }],
      });
    }

    return this;
  }

  /**
   * Register an agent-facing capability with an explicit verifier and policy.
   * Existing plugin registration remains available, but is not implicitly
   * exposed through the open capability resolver without this declaration.
   */
  async registerCapability(descriptor: CapabilityDescriptor, tool: ToolHandler): Promise<void> {
    this.capabilities.register(descriptor);
    this.tools.register(descriptor.id, tool);
    this.capabilityGateway.register(descriptor);
    await this.policy.registerPolicy({
      id: `capability:${descriptor.id}`,
      description: `Execution policy for ${descriptor.id}.`,
      resource: descriptor.id,
      action: "execute",
      rules: [{ rolesAll: [...descriptor.requiredRoles], confirmationLevel: descriptor.confirmationLevel }],
    });
  }

  createPlanner(llm: LlmAdapter): Planner {
    return new LlmBasedDecisionRuntime(llm, this.capabilities.list());
  }

  buildContext(input: string, context: RuntimeContext): Promise<BuiltContext> {
    return this.contextBuilder.build(input, context);
  }

  /** @deprecated Compatibility entry point. Gateways must use handle(). */
  execute(plan: PlannedAction, context: RuntimeContext) {
    return this.actions.execute(plan, context);
  }

  /** Canonical governed entry point. Gateways must not call execute(). */
  handle(request: InboundRequest, interpreter: IntentInterpreter): Promise<RuntimeOutcome> {
    return this.orchestrator.handle(request, interpreter);
  }
}

export interface OipRuntimeOptions {
  readonly memory?: MemoryStore;
  readonly memoryRuntime?: MemoryRuntime;
  /** TanStack MemoryAdapter, e.g. redis(...) or a compatible SQLite adapter. */
  readonly memoryAdapter?: MemoryAdapter;
  readonly memoryNamespace?: string;
  readonly events?: EventPublisher & { list?: () => unknown };
  readonly audit?: AuditLogger & { list?: () => unknown };
  readonly vector?: VectorAdapter;
  readonly documentParser?: DocumentAdapter;
  readonly ocr?: OcrAdapter;
  readonly automation?: AutomationAdapter;
  readonly mcp?: McpAdapter;
  readonly identity?: IdentityRuntime;
  readonly policy?: PolicyRuntime;
  readonly decision?: DecisionRuntime;
  readonly workflow?: WorkflowRuntime;
}

function missingIdentityRuntime(): IdentityRuntime {
  return {
    authenticate: async () => { throw new Error("OipRuntime.handle requires an IdentityRuntime."); },
    resolveWorkspace: async () => { throw new Error("OipRuntime.handle requires an IdentityRuntime."); },
  };
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
export { RuntimeOrchestrator, type IntentInterpreter, type RuntimeOutcome } from "./orchestrator.js";
export { DirectIntentInterpreter, LlmIntentInterpreter } from "./intent.js";
export {
  TanStackMemoryRuntime,
  TanStackMemoryStoreAdapter,
  createTanStackMemoryMiddleware,
  memoryScopeFromExecutionContext,
  type TanStackMemoryMiddlewareOptions,
  type TanStackMemoryRuntimeOptions,
} from "../../memory-runtime/src/index.js";
export type { MemoryAdapter, MemoryScope } from "../../memory-runtime/src/index.js";
export type { ExecutionContext } from "../../core/src/contracts/index.js";
export {
  CapabilityGateway,
  CapabilityResolver,
  type CapabilityAvailability,
  type CapabilityDescriptor,
  type CapabilityGatewayResult,
  type CapabilityGatewayStatus,
  type CapabilityGatewayAuditRecord,
  type CapabilityInvocationRequest,
  type CapabilityMatch,
  type CapabilityProcedure,
  type CapabilityQuery,
  type CapabilityResolution,
  type CapabilityVerification,
  type FunctionToolDefinition,
} from "../../capability-gateway/src/index.js";
export { AgentRegistry } from "./agent-registry.js";
export {
  InMemoryRuntimeExecutionObservability,
  type RuntimeExecutionObservability,
  type RuntimeExecutionRecord,
} from "./observability.js";
