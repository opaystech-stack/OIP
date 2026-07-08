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
  PolicyRuntime,
  RuntimeBuilderOptions,
  SkillRuntime,
  WorkflowRuntime,
} from "../../core/src/contracts/index.js";
import { InMemoryIdentityRuntime } from "../../identity-runtime/src/index.js";
import { InMemoryEventRuntime } from "../../event-runtime/src/index.js";
import { InMemoryMemoryRuntime } from "../../memory-runtime/src/index.js";
import { InMemoryContextRuntime } from "../../context-runtime/src/index.js";
import { RuleBasedDecisionRuntime } from "../../decision-runtime/src/index.js";
import { InMemoryPolicyRuntime } from "../../policy-runtime/src/index.js";
import type { OipRuntimeOptions } from "./index.js";
import { OipRuntime } from "./index.js";
import { ComposedRuntime } from "./composed.js";

function createDefaultChannelRuntime(): ChannelRuntime {
  return {
    receive: async (request) => request,
    send: async () => Promise.resolve(),
  };
}

function createDefaultObservabilityRuntime(): ObservabilityRuntime {
  return {
    trace: async <T>(_name: string, operation: () => Promise<T>): Promise<T> => {
      return await operation();
    },
    log: async () => Promise.resolve(),
  };
}

function createDefaultWorkflowRuntime(): WorkflowRuntime {
  return {
    start: async () => {
      throw new Error("WorkflowRuntime not configured.");
    },
    signal: async () => {
      throw new Error("WorkflowRuntime not configured.");
    },
    getState: async () => {
      throw new Error("WorkflowRuntime not configured.");
    },
    listDefinitions: async () => [],
  };
}

function createDefaultSkillRuntime(): SkillRuntime {
  return {
    invoke: async () => {
      throw new Error("SkillRuntime not configured.");
    },
    list: async () => [],
  };
}

function createDefaultKnowledgeRuntime(): KnowledgeRuntime {
  return {
    registerSource: async () => Promise.resolve(),
    ingest: async () => ({ documentId: "stub", chunks: 0, status: "completed" as const }),
    search: async () => [],
  };
}

function createDefaultLlmRuntime(): LlmRuntime {
  return {
    generateText: async () => "",
    generateJson: async <T>() => ({}) as T,
    embed: async () => [],
  };
}

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
    const identity = this.runtimes.identity ?? new InMemoryIdentityRuntime();
    const event = this.runtimes.event ?? new InMemoryEventRuntime();
    const memory = this.runtimes.memory ?? new InMemoryMemoryRuntime();

    return new ComposedRuntime({
      channel: this.runtimes.channel ?? createDefaultChannelRuntime(),
      identity,
      context: this.runtimes.context ?? new InMemoryContextRuntime(memory),
      llm: this.runtimes.llm ?? createDefaultLlmRuntime(),
      decision: this.runtimes.decision,
      policy: this.runtimes.policy ?? new InMemoryPolicyRuntime(),
      workflow: this.runtimes.workflow ?? createDefaultWorkflowRuntime(),
      ...(this.runtimes.action !== undefined ? { action: this.runtimes.action } : {}),
      memory,
      knowledge: this.runtimes.knowledge ?? createDefaultKnowledgeRuntime(),
      event,
      skill: this.runtimes.skill ?? createDefaultSkillRuntime(),
      observability: this.runtimes.observability ?? createDefaultObservabilityRuntime(),
    } as Required<RuntimeBuilderOptions>);
  }

  static withDefaults(options: OipRuntimeOptions = {}): OipRuntime {
    return new OipRuntimeBuilder().withOptions(options).build();
  }
}

export { ComposedRuntime } from "./composed.js";
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
  PolicyRuntime,
  RuntimeBuilderOptions,
  SkillRuntime,
  WorkflowRuntime,
} from "../../core/src/contracts/index.js";
export type { OipRuntimeOptions } from "./index.js";
