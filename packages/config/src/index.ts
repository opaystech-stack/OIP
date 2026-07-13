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

/**
 * Configuration for the service-to-service connection to Opays HQ.
 * The API key is NEVER hard-coded: it is read from the OIP_API_KEY secret
 * provided by the runtime environment.
 */
export interface HqConnectorConfig {
  readonly baseUrl: string;
  readonly apiKey: string;
  readonly timeoutMs: number;
}

/**
 * Load the HQ connector configuration from the environment.
 * - HQ_BASE_URL : base URL of the Opays HQ instance (e.g. https://hq.opays.io)
 * - OIP_API_KEY : service-to-service secret sent as the `x-oip-api-key` header
 * - OIP_HQ_TIMEOUT_MS : optional request timeout (defaults to 15000ms)
 */
export function loadHqConfig(env: Record<string, string | undefined> = process.env): HqConnectorConfig {
  const baseUrl = trimTrailingSlash(requiredEnv(env, "HQ_BASE_URL"));
  const apiKey = requiredEnv(env, "OIP_API_KEY");
  const rawTimeout = env.OIP_HQ_TIMEOUT_MS;
  const timeoutMs = rawTimeout ? Number(rawTimeout) : 15_000;

  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new Error(`Invalid OIP_HQ_TIMEOUT_MS: ${rawTimeout}`);
  }

  return { baseUrl, apiKey, timeoutMs };
}

function trimTrailingSlash(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value;
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
