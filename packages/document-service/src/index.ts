import type { JsonObject } from "../../core/src/index.js";
import type { DocumentAdapter, OcrAdapter } from "../../adapters/src/index.js";
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

export interface BinaryDocumentInput {
  readonly name: string;
  readonly bytes: Uint8Array;
  readonly mimeType: string;
  readonly metadata?: JsonObject;
}

export class DocumentService {
  constructor(
    private readonly target: MutableKnowledgeSource,
    private readonly chunkSize = 800,
    private readonly parser?: DocumentAdapter,
    private readonly ocr?: OcrAdapter,
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

  async ingestBinary(input: BinaryDocumentInput): Promise<IngestedDocument> {
    if (this.parser) {
      const parsed = await this.parser.parse(input);

      return this.ingest({
        title: input.name,
        text: parsed.text,
        metadata: {
          ...parsed.metadata,
          ...(input.metadata ?? {}),
        },
      });
    }

    if (this.ocr && input.mimeType.startsWith("image/")) {
      const text = await this.ocr.extractText(input);

      return this.ingest({
        title: input.name,
        text,
        metadata: {
          mimeType: input.mimeType,
          ...(input.metadata ?? {}),
        },
      });
    }

    throw new Error(`No document adapter available for mime type: ${input.mimeType}`);
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
