import type {
  ExecutionContext,
  KnowledgeQuery,
  KnowledgeResult,
  KnowledgeRuntime,
  KnowledgeSource,
  IngestionResult,
} from "../../core/src/contracts/index.js";
import type { KnowledgeEngine } from "../../knowledge-engine/src/index.js";

export class KnowledgeEngineRuntime implements KnowledgeRuntime {
  constructor(private readonly engine: KnowledgeEngine) {}

  async registerSource(source: KnowledgeSource): Promise<void> {
    const mutable = { id: source.id, name: source.name };
    this.engine.register(mutable as import("../../knowledge-engine/src/index.js").KnowledgeSource);
  }

  async ingest(_sourceId: string, _document: unknown): Promise<IngestionResult> {
    return { documentId: "stub", chunks: 0, status: "completed" };
  }

  async search(query: KnowledgeQuery): Promise<readonly KnowledgeResult[]> {
    // Bridge to existing KnowledgeEngine: requires RuntimeContext which is not in KnowledgeQuery.
    // Minimal stub until full alignment.
    return [];
  }
}

export type { KnowledgeQuery, KnowledgeResult, KnowledgeRuntime, KnowledgeSource, IngestionResult } from "../../core/src/contracts/index.js";
