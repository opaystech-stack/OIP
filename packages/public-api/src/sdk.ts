import { OipPublicApi, type PublicApiDependencies } from "./public-api.js";
import type {
  JsonObject,
  LlmGenerateTextPayload,
  LlmGenerateTextResult,
  OipPublicRequest,
  OipPublicResponse,
  RuntimeContext,
} from "./types.js";

export interface OipPublicClientOptions {
  readonly runtimeContext: RuntimeContext;
  readonly api?: OipPublicApi;
  readonly baseUrl?: string;
  readonly apiKey?: string;
}

export class OipPublicClient {
  private readonly context: RuntimeContext;
  private readonly api: OipPublicApi | undefined;
  private readonly baseUrl: string | undefined;
  private readonly apiKey: string | undefined;

  constructor(options: OipPublicClientOptions) {
    this.context = options.runtimeContext;
    this.api = options.api;
    this.baseUrl = options.baseUrl;
    this.apiKey = options.apiKey;
  }

  static create(options: OipPublicClientOptions): OipPublicClient {
    return new OipPublicClient(options);
  }

  async invoke<TResult = JsonObject>(
    request: Omit<OipPublicRequest, "context" | "requestId"> & { requestId?: string },
  ): Promise<OipPublicResponse<TResult>> {
    const fullRequest: OipPublicRequest = {
      ...request,
      requestId: request.requestId ?? crypto.randomUUID(),
      context: this.context,
    };

    if (this.api) {
      return this.api.invoke(fullRequest);
    }

    if (this.baseUrl) {
      return this.invokeHttp(fullRequest);
    }

    throw new Error("OipPublicClient requires either an api instance or a baseUrl.");
  }

  async llmGenerateText(payload: LlmGenerateTextPayload): Promise<LlmGenerateTextResult> {
    const response = await this.invoke<LlmGenerateTextResult>({
      operation: "llm.generateText",
      payload: payload as unknown as JsonObject,
    });

    if (response.status !== "completed" || response.result === undefined) {
      throw new Error(response.error?.message ?? "llm.generateText failed");
    }

    return response.result;
  }

  private async invokeHttp<TResult>(request: OipPublicRequest): Promise<OipPublicResponse<TResult>> {
    const headers: Record<string, string> = {
      "content-type": "application/json",
      "x-oip-api-version": "v1",
    };

    if (this.apiKey) {
      headers["authorization"] = `Bearer ${this.apiKey}`;
    }

    const response = await fetch(`${this.baseUrl}/v1/oip/invoke`, {
      method: "POST",
      headers,
      body: JSON.stringify(request),
    });

    return (await response.json()) as OipPublicResponse<TResult>;
  }
}

export * from "./types.js";
export { OipPublicApi, type PublicApiDependencies } from "./public-api.js";
