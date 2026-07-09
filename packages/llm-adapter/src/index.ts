import type { JsonObject } from "../../core/src/index.js";

export interface LlmMessage {
  readonly role: "system" | "user" | "assistant";
  readonly content: string;
}

export interface LlmTextRequest {
  readonly messages: readonly LlmMessage[];
  readonly temperature?: number | undefined;
  readonly maxTokens?: number | undefined;
  readonly metadata?: JsonObject | undefined;
}

export interface LlmTextResult {
  readonly text: string;
  readonly model?: string | undefined;
  readonly usage?: {
    readonly promptTokens: number;
    readonly completionTokens: number;
  } | undefined;
}

export interface LlmJsonRequest {
  readonly messages: readonly LlmMessage[];
  readonly schemaName: string;
  readonly temperature?: number | undefined;
  readonly metadata?: JsonObject | undefined;
}

export interface LlmAdapter {
  generateText(request: LlmTextRequest): Promise<LlmTextResult>;
  generateJson(request: LlmJsonRequest): Promise<JsonObject>;
}

export class MockLlmAdapter implements LlmAdapter {
  constructor(private readonly handler: (request: LlmJsonRequest) => JsonObject | Promise<JsonObject>) {}

  async generateJson(request: LlmJsonRequest): Promise<JsonObject> {
    return this.handler(request);
  }

  async generateText(request: LlmTextRequest): Promise<LlmTextResult> {
    const json = await this.generateJson({
      messages: request.messages,
      schemaName: "oip.text.v1",
      temperature: request.temperature,
      metadata: request.metadata,
    });

    return {
      text: String(json.text ?? json.content ?? ""),
      model: typeof json.model === "string" ? json.model : undefined,
      usage:
        typeof json.usage === "object" && json.usage !== null && !Array.isArray(json.usage)
          ? ({
              promptTokens: Number((json.usage as JsonObject).promptTokens ?? 0),
              completionTokens: Number((json.usage as JsonObject).completionTokens ?? 0),
            } as LlmTextResult["usage"])
          : undefined,
    };
  }
}

export * from "./openai-compatible.js";
