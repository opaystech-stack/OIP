import type { JsonObject } from "../../core/src/index.js";

export interface VectorSearchResult {
  readonly id: string;
  readonly score: number;
  readonly metadata: JsonObject;
}

export interface VectorAdapter {
  upsert(items: readonly { readonly id: string; readonly embedding: readonly number[]; readonly metadata: JsonObject }[]): Promise<void>;
  search(embedding: readonly number[], limit: number): Promise<readonly VectorSearchResult[]>;
}

export interface DocumentAdapter {
  parse(input: { readonly name: string; readonly bytes: Uint8Array; readonly mimeType: string }): Promise<{
    readonly text: string;
    readonly metadata: JsonObject;
  }>;
}

export interface OcrAdapter {
  extractText(input: { readonly bytes: Uint8Array; readonly mimeType: string }): Promise<string>;
}

export interface ObservabilityAdapter {
  trace<T>(name: string, metadata: JsonObject, operation: () => Promise<T>): Promise<T>;
}

export interface TraceRecord {
  readonly name: string;
  readonly status: "completed" | "failed";
  readonly startedAt: string;
  readonly durationMs: number;
  readonly metadata: JsonObject;
  readonly error?: string;
}

export class InMemoryObservabilityAdapter implements ObservabilityAdapter {
  private readonly traces: TraceRecord[] = [];

  async trace<T>(name: string, metadata: JsonObject, operation: () => Promise<T>): Promise<T> {
    const startedAtMs = Date.now();
    const startedAt = new Date(startedAtMs).toISOString();

    try {
      const result = await operation();
      this.traces.push({
        name,
        status: "completed",
        startedAt,
        durationMs: Date.now() - startedAtMs,
        metadata,
      });

      return result;
    } catch (error) {
      this.traces.push({
        name,
        status: "failed",
        startedAt,
        durationMs: Date.now() - startedAtMs,
        metadata,
        error: error instanceof Error ? error.message : "Unknown error",
      });

      throw error;
    }
  }

  list(): readonly TraceRecord[] {
    return [...this.traces];
  }
}

export interface AutomationAdapter {
  trigger(workflowId: string, payload: JsonObject): Promise<void>;
}

export interface McpAdapter {
  callTool(serverName: string, toolName: string, args: JsonObject): Promise<JsonObject>;
}
