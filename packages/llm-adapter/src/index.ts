import type { JsonObject } from "../../core/src/index.js";

export interface LlmMessage {
  readonly role: "system" | "user" | "assistant";
  readonly content: string;
}

export interface LlmJsonRequest {
  readonly messages: readonly LlmMessage[];
  readonly schemaName: string;
  readonly temperature?: number;
  readonly metadata?: JsonObject;
}

export interface LlmAdapter {
  generateJson(request: LlmJsonRequest): Promise<JsonObject>;
}

export class MockLlmAdapter implements LlmAdapter {
  constructor(private readonly handler: (request: LlmJsonRequest) => JsonObject | Promise<JsonObject>) {}

  async generateJson(request: LlmJsonRequest): Promise<JsonObject> {
    return this.handler(request);
  }
}

export * from "./openai-compatible.js";
