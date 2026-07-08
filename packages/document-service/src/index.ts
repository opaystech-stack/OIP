import type { JsonObject } from "../../core/src/index.js";
import { MutableKnowledgeSource } from "../../knowledge-engine/src/index.js";

export interface DocumentInput {
  readonly title: string;
  readonly text: string;
  readonly metadata?: JsonObject;
}

export interface IngestedDocument {
  readonly title: string;
  readonly chunkCount: number;
}

export class DocumentService {
  constructor(
    private readonly target: MutableKnowledgeSource,
    private readonly chunkSize = 800,
  ) {}

  ingest(input: DocumentInput): IngestedDocument {
    const chunks = chunkText(input.text, this.chunkSize);

    for (const [index, chunk] of chunks.entries()) {
      this.target.add({
        title: `${input.title} #${index + 1}`,
        content: chunk,
        metadata: {
          ...(input.metadata ?? {}),
          documentTitle: input.title,
          chunkIndex: index,
        },
      });
    }

    return {
      title: input.title,
      chunkCount: chunks.length,
    };
  }
}

export function chunkText(text: string, chunkSize: number): readonly string[] {
  const normalized = text.replace(/\s+/g, " ").trim();

  if (normalized.length === 0) {
    return [];
  }

  const chunks: string[] = [];

  for (let start = 0; start < normalized.length; start += chunkSize) {
    chunks.push(normalized.slice(start, start + chunkSize).trim());
  }

  return chunks;
}
