import type { JsonObject } from "../../core/src/index.js";
import type { VectorAdapter, VectorSearchResult } from "../../adapters/src/index.js";

interface VectorEntry {
  readonly id: string;
  readonly embedding: readonly number[];
  readonly metadata: JsonObject;
}

export class InMemoryVectorAdapter implements VectorAdapter {
  private readonly entries = new Map<string, VectorEntry>();

  async upsert(items: readonly VectorEntry[]): Promise<void> {
    for (const item of items) {
      this.entries.set(item.id, item);
    }
  }

  async search(embedding: readonly number[], limit: number): Promise<readonly VectorSearchResult[]> {
    return [...this.entries.values()]
      .map((entry) => ({
        id: entry.id,
        score: cosineSimilarity(embedding, entry.embedding),
        metadata: entry.metadata,
      }))
      .sort((left, right) => right.score - left.score)
      .slice(0, limit);
  }
}

export function cosineSimilarity(left: readonly number[], right: readonly number[]): number {
  if (left.length !== right.length || left.length === 0) {
    return 0;
  }

  let dot = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;

  for (let index = 0; index < left.length; index += 1) {
    const leftValue = left[index] ?? 0;
    const rightValue = right[index] ?? 0;

    dot += leftValue * rightValue;
    leftMagnitude += leftValue ** 2;
    rightMagnitude += rightValue ** 2;
  }

  if (leftMagnitude === 0 || rightMagnitude === 0) {
    return 0;
  }

  return dot / (Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude));
}
