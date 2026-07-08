import type { JsonObject, RuntimeContext } from "../../core/src/index.js";

export interface KnowledgeQuery {
  readonly text: string;
  readonly context: RuntimeContext;
  readonly limit: number;
}

export interface KnowledgeResult {
  readonly sourceId: string;
  readonly title: string;
  readonly content: string;
  readonly score: number;
  readonly metadata: JsonObject;
}

export interface KnowledgeSource {
  readonly id: string;
  readonly name: string;
  search(query: KnowledgeQuery): Promise<readonly KnowledgeResult[]>;
}

export class KnowledgeEngine {
  private readonly sources = new Map<string, KnowledgeSource>();

  register(source: KnowledgeSource): void {
    if (this.sources.has(source.id)) {
      throw new Error(`Knowledge source already registered: ${source.id}`);
    }

    this.sources.set(source.id, source);
  }

  async search(text: string, context: RuntimeContext, limit = 5): Promise<readonly KnowledgeResult[]> {
    const results = await Promise.all(
      [...this.sources.values()].map((source) =>
        source.search({
          text,
          context,
          limit,
        }),
      ),
    );

    return results
      .flat()
      .sort((left, right) => right.score - left.score)
      .slice(0, limit);
  }
}

export class MutableKnowledgeSource implements KnowledgeSource {
  private readonly documents: { readonly title: string; readonly content: string; readonly metadata?: JsonObject }[] = [];

  constructor(
    readonly id: string,
    readonly name: string,
  ) {}

  add(document: { readonly title: string; readonly content: string; readonly metadata?: JsonObject }): void {
    this.documents.push(document);
  }

  async search(query: KnowledgeQuery): Promise<readonly KnowledgeResult[]> {
    return searchDocuments(this.id, this.documents, query);
  }
}

export class InMemoryKnowledgeSource implements KnowledgeSource {
  constructor(
    readonly id: string,
    readonly name: string,
    private readonly documents: readonly { readonly title: string; readonly content: string; readonly metadata?: JsonObject }[],
  ) {}

  async search(query: KnowledgeQuery): Promise<readonly KnowledgeResult[]> {
    return searchDocuments(this.id, this.documents, query);
  }
}

function searchDocuments(
  sourceId: string,
  documents: readonly { readonly title: string; readonly content: string; readonly metadata?: JsonObject }[],
  query: KnowledgeQuery,
): readonly KnowledgeResult[] {
  const terms = query.text.toLowerCase().split(/\s+/).filter(Boolean);

  return documents
    .map((document) => {
      const haystack = `${document.title} ${document.content}`.toLowerCase();
      const matches = terms.filter((term) => haystack.includes(term)).length;

      return {
        sourceId,
        title: document.title,
        content: document.content,
        score: terms.length === 0 ? 0 : matches / terms.length,
        metadata: document.metadata ?? {},
      };
    })
    .filter((result) => result.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, query.limit);
}
