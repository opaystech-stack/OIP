import type { JsonObject, RuntimeContext } from "../../core/src/index.js";
import type { KnowledgeEngine } from "../../knowledge-engine/src/index.js";
import type { MemoryStore } from "../../memory/src/index.js";

export interface BuiltContext {
  readonly runtime: RuntimeContext;
  readonly knowledge: readonly {
    readonly sourceId: string;
    readonly title: string;
    readonly content: string;
    readonly score: number;
    readonly metadata: JsonObject;
  }[];
  readonly metadata: JsonObject;
  readonly memory: readonly {
    readonly input: string;
    readonly response: string;
    readonly occurredAt: string;
  }[];
}

export class ContextBuilder {
  constructor(
    private readonly knowledge?: KnowledgeEngine,
    private readonly memory?: MemoryStore,
  ) {}

  async build(input: string, runtime: RuntimeContext): Promise<BuiltContext> {
    const [knowledge, memory] = await Promise.all([
      this.knowledge ? this.knowledge.search(input, runtime) : [],
      this.memory ? this.memory.recent(runtime, 5) : [],
    ]);

    return {
      runtime,
      knowledge,
      metadata: {
        channel: runtime.channel,
        locale: runtime.user.locale,
        activeModule: runtime.user.activeModule ?? null,
        activePage: runtime.user.activePage ?? null,
      },
      memory: memory.map((entry) => ({
        input: entry.input,
        response: entry.response,
        occurredAt: entry.occurredAt,
      })),
    };
  }
}
