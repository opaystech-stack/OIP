import type { LlmAdapter, LlmMessage } from "../../llm-adapter/src/index.js";
import type { LlmRuntime } from "../../core/src/contracts/index.js";

export class LlmAdapterRuntime implements LlmRuntime {
  constructor(private readonly adapter: LlmAdapter) {}

  async generateText(messages: readonly unknown[], _options?: unknown): Promise<string> {
    const response = await this.adapter.generateJson({
      messages: messages as readonly LlmMessage[],
      schemaName: "oip.text.v1",
    });
    return String(response.content ?? response.text ?? "");
  }

  async generateJson<T>(messages: readonly unknown[], _schema?: unknown): Promise<T> {
    const response = await this.adapter.generateJson({
      messages: messages as readonly LlmMessage[],
      schemaName: "oip.json.v1",
    });
    return response as T;
  }

  async embed(_text: string): Promise<readonly number[]> {
    return [];
  }
}

export type { LlmRuntime } from "../../core/src/contracts/index.js";
