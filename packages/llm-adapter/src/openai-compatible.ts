import type { JsonObject } from "../../core/src/index.js";
import type { LlmAdapter, LlmJsonRequest, LlmTextRequest, LlmTextResult } from "./index.js";

export interface OpenAiCompatibleConfig {
  readonly baseUrl: string;
  readonly apiKey: string;
  readonly model: string;
  readonly fetch?: FetchLike;
}

export type FetchLike = (
  url: string,
  init: {
    readonly method: "POST";
    readonly headers: Record<string, string>;
    readonly body: string;
  },
) => Promise<{
  readonly ok: boolean;
  readonly status: number;
  text(): Promise<string>;
  json(): Promise<unknown>;
}>;

export class OpenAiCompatibleLlmAdapter implements LlmAdapter {
  private readonly fetchImpl: FetchLike;

  constructor(private readonly config: OpenAiCompatibleConfig) {
    this.fetchImpl = config.fetch ?? defaultFetch;
  }

  async generateText(request: LlmTextRequest): Promise<LlmTextResult> {
    const response = await this.fetchImpl(`${trimTrailingSlash(this.config.baseUrl)}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.model,
        temperature: request.temperature ?? 0,
        max_tokens: request.maxTokens,
        messages: request.messages,
      }),
    });

    if (!response.ok) {
      throw new Error(`LLM request failed with status ${response.status}: ${await response.text()}`);
    }

    const payload = await response.json();
    const content = extractContent(payload);

    return {
      text: content,
      model: typeof (payload as JsonObject).model === "string" ? ((payload as JsonObject).model as string) : undefined,
      usage: extractUsage(payload as JsonObject),
    };
  }

  async generateJson(request: LlmJsonRequest): Promise<JsonObject> {
    const response = await this.fetchImpl(`${trimTrailingSlash(this.config.baseUrl)}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.model,
        temperature: request.temperature ?? 0,
        messages: request.messages,
        response_format: { type: "json_object" },
        metadata: request.metadata,
      }),
    });

    if (!response.ok) {
      throw new Error(`LLM request failed with status ${response.status}: ${await response.text()}`);
    }

    const payload = await response.json();
    const content = extractContent(payload);

    try {
      const parsed = JSON.parse(content) as unknown;

      if (isJsonObject(parsed)) {
        return parsed;
      }
    } catch {
      throw new Error("LLM response content is not valid JSON.");
    }

    throw new Error("LLM response JSON is not an object.");
  }
}

const defaultFetch: FetchLike = async (url, init) => {
  const response = await fetch(url, init);

  return {
    ok: response.ok,
    status: response.status,
    text: () => response.text(),
    json: () => response.json() as Promise<unknown>,
  };
};

function extractContent(payload: unknown): string {
  if (!isJsonObject(payload)) {
    throw new Error("LLM response payload is not an object.");
  }

  const choices = payload.choices;

  if (!Array.isArray(choices)) {
    throw new Error("LLM response payload is missing choices.");
  }

  const firstChoice = choices[0];

  if (!isJsonObject(firstChoice) || !isJsonObject(firstChoice.message)) {
    throw new Error("LLM response payload is missing message.");
  }

  const content = firstChoice.message.content;

  if (typeof content !== "string") {
    throw new Error("LLM response payload is missing string content.");
  }

  return content;
}

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function trimTrailingSlash(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function extractUsage(payload: JsonObject): LlmTextResult["usage"] {
  const usage = payload.usage;

  if (
    typeof usage === "object" &&
    usage !== null &&
    !Array.isArray(usage) &&
    typeof (usage as JsonObject).promptTokens === "number" &&
    typeof (usage as JsonObject).completionTokens === "number"
  ) {
    return {
      promptTokens: Number((usage as JsonObject).promptTokens),
      completionTokens: Number((usage as JsonObject).completionTokens),
    };
  }

  return undefined;
}
