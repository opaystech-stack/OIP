import {
  type LlmRuntime,
  type ActionRuntime,
  type MemoryRuntime,
  type KnowledgeRuntime,
  type EventRuntime,
  type DecisionRuntime,
  type PolicyRuntime,
  type WorkflowRuntime,
  type SkillRuntime,
  type ContextRuntime,
  type IdentityRuntime,
  type ObservabilityRuntime,
  type RuntimeBuilderOptions,
} from "../../core/src/contracts/index.js";
import type { OipRuntimeOptions } from "./index.js";
import { OipRuntime } from "./index.js";

export interface RuntimeBuilderConfig extends OipRuntimeOptions {
  readonly llmRuntime?: LlmRuntime;
  readonly actionRuntime?: ActionRuntime;
  readonly memoryRuntime?: MemoryRuntime;
  readonly knowledgeRuntime?: KnowledgeRuntime;
  readonly eventRuntime?: EventRuntime;
  readonly decisionRuntime?: DecisionRuntime;
  readonly policyRuntime?: PolicyRuntime;
  readonly workflowRuntime?: WorkflowRuntime;
  readonly skillRuntime?: SkillRuntime;
  readonly contextRuntime?: ContextRuntime;
  readonly identityRuntime?: IdentityRuntime;
  readonly observabilityRuntime?: ObservabilityRuntime;
}

export class OipRuntimeBuilder {
  private config: RuntimeBuilderConfig = {};

  withOptions(options: OipRuntimeOptions): this {
    this.config = { ...this.config, ...options };
    return this;
  }

  withLlmRuntime(runtime: LlmRuntime): this {
    this.config = { ...this.config, llmRuntime: runtime };
    return this;
  }

  withActionRuntime(runtime: ActionRuntime): this {
    this.config = { ...this.config, actionRuntime: runtime };
    return this;
  }

  withMemoryRuntime(runtime: MemoryRuntime): this {
    this.config = { ...this.config, memoryRuntime: runtime };
    return this;
  }

  withKnowledgeRuntime(runtime: KnowledgeRuntime): this {
    this.config = { ...this.config, knowledgeRuntime: runtime };
    return this;
  }

  withEventRuntime(runtime: EventRuntime): this {
    this.config = { ...this.config, eventRuntime: runtime };
    return this;
  }

  withDecisionRuntime(runtime: DecisionRuntime): this {
    this.config = { ...this.config, decisionRuntime: runtime };
    return this;
  }

  withPolicyRuntime(runtime: PolicyRuntime): this {
    this.config = { ...this.config, policyRuntime: runtime };
    return this;
  }

  withWorkflowRuntime(runtime: WorkflowRuntime): this {
    this.config = { ...this.config, workflowRuntime: runtime };
    return this;
  }

  withSkillRuntime(runtime: SkillRuntime): this {
    this.config = { ...this.config, skillRuntime: runtime };
    return this;
  }

  withContextRuntime(runtime: ContextRuntime): this {
    this.config = { ...this.config, contextRuntime: runtime };
    return this;
  }

  withIdentityRuntime(runtime: IdentityRuntime): this {
    this.config = { ...this.config, identityRuntime: runtime };
    return this;
  }

  withObservabilityRuntime(runtime: ObservabilityRuntime): this {
    this.config = { ...this.config, observabilityRuntime: runtime };
    return this;
  }

  build(): OipRuntime {
    // For Sprint 1, the builder delegates to the existing OipRuntime constructor
    // while storing injected runtime contracts for future phases.
    // This guarantees full backward compatibility.
    return new OipRuntime(this.config);
  }

  static withDefaults(options: OipRuntimeOptions = {}): OipRuntime {
    return new OipRuntimeBuilder().withOptions(options).build();
  }
}
