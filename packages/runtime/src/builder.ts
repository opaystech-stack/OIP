import {
  ActionEngine,
  CapabilityRegistry,
  ToolRegistry,
  Validator,
} from "../../core/src/index.js";
import { InMemoryAuditLog } from "../../audit-log/src/index.js";
import { InMemoryEventBus } from "../../event-bus/src/index.js";
import type {
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
import type { OipRuntimeOptions } from "./index.js";
import { OipRuntime } from "./index.js";

export class OipRuntimeBuilder {
  private legacyOptions: OipRuntimeOptions = {};
  private runtimes: Partial<RuntimeBuilderOptions> = {};

  withOptions(options: OipRuntimeOptions): this {
    this.legacyOptions = { ...this.legacyOptions, ...options };
    return this;
  }

  withLlmRuntime(runtime: LlmRuntime): this {
    this.runtimes = { ...this.runtimes, llm: runtime };
    return this;
  }

  withActionRuntime(runtime: ActionRuntime): this {
    this.runtimes = { ...this.runtimes, action: runtime };
    return this;
  }

  withMemoryRuntime(runtime: MemoryRuntime): this {
    this.runtimes = { ...this.runtimes, memory: runtime };
    return this;
  }

  withKnowledgeRuntime(runtime: KnowledgeRuntime): this {
    this.runtimes = { ...this.runtimes, knowledge: runtime };
    return this;
  }

  withEventRuntime(runtime: EventRuntime): this {
    this.runtimes = { ...this.runtimes, event: runtime };
    return this;
  }

  withDecisionRuntime(runtime: DecisionRuntime): this {
    this.runtimes = { ...this.runtimes, decision: runtime };
    return this;
  }

  withPolicyRuntime(runtime: PolicyRuntime): this {
    this.runtimes = { ...this.runtimes, policy: runtime };
    return this;
  }

  withWorkflowRuntime(runtime: WorkflowRuntime): this {
    this.runtimes = { ...this.runtimes, workflow: runtime };
    return this;
  }

  withSkillRuntime(runtime: SkillRuntime): this {
    this.runtimes = { ...this.runtimes, skill: runtime };
    return this;
  }

  withContextRuntime(runtime: ContextRuntime): this {
    this.runtimes = { ...this.runtimes, context: runtime };
    return this;
  }

  withIdentityRuntime(runtime: IdentityRuntime): this {
    this.runtimes = { ...this.runtimes, identity: runtime };
    return this;
  }

  withObservabilityRuntime(runtime: ObservabilityRuntime): this {
    this.runtimes = { ...this.runtimes, observability: runtime };
    return this;
  }

  withChannelRuntime(runtime: ChannelRuntime): this {
    this.runtimes = { ...this.runtimes, channel: runtime };
    return this;
  }

  build(): OipRuntime {
    return new OipRuntime(this.legacyOptions);
  }

  buildComposed(): ComposedRuntime {
    return new ComposedRuntime(this.runtimes);
  }

  static withDefaults(options: OipRuntimeOptions = {}): OipRuntime {
    return new OipRuntimeBuilder().withOptions(options).build();
  }
}

import { WorkflowRegistry } from "../../workflow-engine/src/index.js";
import { installPluginModule, type OipPluginModule } from "../../plugin-sdk/src/index.js";

export class ComposedRuntime {
  readonly capabilities = new CapabilityRegistry();
  readonly tools = new ToolRegistry();
  readonly workflows = new WorkflowRegistry();
  readonly actions: ActionEngine;

  constructor(private readonly runtimes: Partial<RuntimeBuilderOptions> = {}) {
    const events = (this.runtimes.event as unknown as import("../../core/src/types.js").EventPublisher) ?? new InMemoryEventBus();
    const audit = new InMemoryAuditLog();
    this.actions = new ActionEngine(this.capabilities, this.tools, new Validator(), events, audit);
  }

  use(module: OipPluginModule): this {
    installPluginModule(module, {
      capabilities: this.capabilities,
      tools: this.tools,
      workflows: this.workflows,
    });
    return this;
  }

  async execute(action: PlannedAction, context: import("../../core/src/contracts/index.js").ExecutionContext) {
    return this.actions.execute(action, context as unknown as import("../../core/src/types.js").RuntimeContext);
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
export type { OipRuntimeOptions } from "./index.js";
