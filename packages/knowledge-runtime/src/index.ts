import type {
  ExecutionContext,
  KnowledgeQuery,
  KnowledgeResult,
  KnowledgeRuntime,
  KnowledgeSource,
  IngestionResult,
} from "../../core/src/contracts/index.js";
import type { KnowledgeEngine } from "../../knowledge-engine/src/index.js";
import type { DocumentService } from "../../document-service/src/index.js";

export class KnowledgeEngineRuntime implements KnowledgeRuntime {
  constructor(
    private readonly engine: KnowledgeEngine,
    private readonly documents?: DocumentService,
  ) {}

  async registerSource(source: KnowledgeSource): Promise<void> {
    const mutable = { id: source.id, name: source.name };
    this.engine.register(mutable as import("../../knowledge-engine/src/index.js").KnowledgeSource);
  }

  async ingest(sourceId: string, document: unknown): Promise<IngestionResult> {
    if (sourceId !== "documents" || !this.documents || !isDocument(document)) {
      return { documentId: "unsupported", chunks: 0, status: "failed" };
    }
    const result = this.documents.ingest({
      title: document.title,
      text: document.content,
      ...(document.metadata !== undefined ? { metadata: document.metadata } : {}),
    });
    return { documentId: document.id, chunks: result.chunkCount, status: "completed" };
  }

  async search(query: KnowledgeQuery): Promise<readonly KnowledgeResult[]> {
    const results = await this.engine.search(query.query, {
      requestId: `knowledge-${Date.now()}`,
      channel: "api",
      user: { userId: "runtime", organizationId: query.workspaceId, roles: [] },
    });
    return results.slice(0, query.limit ?? 5).map((result, index) => ({
      id: `${result.sourceId}:${result.title}:${index}`,
      title: result.title,
      content: result.content,
      sourceId: result.sourceId,
      score: result.score,
      metadata: result.metadata,
    }));
  }
}

function isDocument(value: unknown): value is {
  id: string;
  title: string;
  content: string;
  metadata?: import("../../core/src/contracts/common.js").JsonObject;
} {
  return typeof value === "object" && value !== null &&
    typeof (value as { id?: unknown }).id === "string" &&
    typeof (value as { title?: unknown }).title === "string" &&
    typeof (value as { content?: unknown }).content === "string";
}

export type { KnowledgeQuery, KnowledgeResult, KnowledgeRuntime, KnowledgeSource, IngestionResult } from "../../core/src/contracts/index.js";
