import { MockLlmAdapter, OpenAiCompatibleLlmAdapter, type LlmAdapter } from "../../llm-adapter/src/index.js";

export type LlmConfig =
  | { readonly provider: "mock" }
  | {
      readonly provider: "openai-compatible";
      readonly baseUrl: string;
      readonly apiKey: string;
      readonly model: string;
    };

export function loadLlmConfig(env: Record<string, string | undefined> = process.env): LlmConfig {
  const provider = env.OIP_LLM_PROVIDER ?? "mock";

  if (provider === "mock") {
    return { provider: "mock" };
  }

  if (provider !== "openai-compatible") {
    throw new Error(`Unsupported OIP_LLM_PROVIDER: ${provider}`);
  }

  const baseUrl = requiredEnv(env, "OIP_LLM_BASE_URL");
  const apiKey = requiredEnv(env, "OIP_LLM_API_KEY");
  const model = requiredEnv(env, "OIP_LLM_MODEL");

  return {
    provider: "openai-compatible",
    baseUrl,
    apiKey,
    model,
  };
}

export function createLlmAdapter(config: LlmConfig): LlmAdapter {
  if (config.provider === "mock") {
    return new MockLlmAdapter(() => ({
      capabilityId: "commerce.inventory.add",
      arguments: {
        itemName: "sacs de ciment",
        quantity: 20,
      },
      confidence: 0.7,
      reason: "Mock planner response for local development.",
    }));
  }

  return new OpenAiCompatibleLlmAdapter({
    baseUrl: config.baseUrl,
    apiKey: config.apiKey,
    model: config.model,
  });
}

function requiredEnv(env: Record<string, string | undefined>, name: string): string {
  const value = env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}
