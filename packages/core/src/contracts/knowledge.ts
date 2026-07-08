import type { JsonObject } from "./common.js";

export type KnowledgeSourceType = "documents" | "database" | "api" | "website" | "github" | "email";

export interface KnowledgeSource {
  readonly id: string;
  readonly name: string;
  readonly type: KnowledgeSourceType;
  readonly config: JsonObject;
}

export interface KnowledgeQuery {
  readonly query: string;
  readonly workspaceId: string;
  readonly sourceIds?: readonly string[];
  readonly limit?: number;
}

export interface KnowledgeResult {
  readonly id: string;
  readonly title: string;
  readonly content: string;
  readonly sourceId: string;
  readonly score: number;
  readonly metadata?: JsonObject;
}

export interface DocumentInput {
  readonly id: string;
  readonly title: string;
  readonly content?: string;
  readonly binary?: Uint8Array;
  readonly mimeType?: string;
  readonly metadata?: JsonObject;
}

export interface IngestionResult {
  readonly documentId: string;
  readonly chunks: number;
  readonly status: "completed" | "failed";
}
