import type {
  JsonObject,
  LlmGenerateTextPayload,
  LlmGenerateTextResult,
  OipPublicError,
  OipPublicRequest,
  OipPublicResponse,
  RuntimeContext,
  UserContext,
} from "./types.js";
import type { LlmAdapter } from "../../llm-adapter/src/index.js";
import type { OipRuntime } from "../../runtime/src/index.js";

export interface PublicApiDependencies {
  readonly runtime: OipRuntime;
  readonly llm: LlmAdapter;
}

export class OipPublicApi {
  readonly version = "v1";
  private readonly runtime: OipRuntime;
  private readonly llm: LlmAdapter;

  constructor(deps: PublicApiDependencies) {
    this.runtime = deps.runtime;
    this.llm = deps.llm;
  }

  async invoke<TResult = JsonObject>(
    request: OipPublicRequest<JsonObject>,
  ): Promise<OipPublicResponse<TResult>> {
    const start = Date.now();
    const version = this.version;

    try {
      switch (request.operation) {
        case "llm.generateText": {
          const result = await this.handleGenerateText(request.payload as unknown as LlmGenerateTextPayload);
          return this.wrap(result, request, start, version) as unknown as OipPublicResponse<TResult>;
        }
        default:
          return this.error(
            {
              code: "operation.not-supported",
              message: `Operation ${request.operation} is not available in this API version.`,
              retryable: false,
              suggestedAction: "none",
            },
            request,
            start,
            version,
          ) as OipPublicResponse<TResult>;
      }
    } catch (error) {
      return this.error(
        {
          code: "internal-error",
          message: error instanceof Error ? error.message : "Internal error",
          retryable: true,
          suggestedAction: "retry",
        },
        request,
        start,
        version,
      ) as OipPublicResponse<TResult>;
    }
  }

  private async handleGenerateText(payload: LlmGenerateTextPayload): Promise<LlmGenerateTextResult> {
    const response = await this.llm.generateText({
      messages: payload.messages,
      temperature: payload.temperature,
      maxTokens: payload.maxTokens,
    });

    return {
      text: response.text,
      model: response.model,
      usage: response.usage,
    };
  }

  private wrap<TResult>(
    result: TResult,
    request: OipPublicRequest,
    start: number,
    version: string,
  ): OipPublicResponse<TResult> {
    return {
      requestId: request.requestId,
      operation: request.operation,
      status: "completed",
      result,
      metadata: {
        durationMs: Date.now() - start,
        version,
      },
    };
  }

  private error(
    error: OipPublicError,
    request: OipPublicRequest,
    start: number,
    version: string,
  ): OipPublicResponse {
    return {
      requestId: request.requestId,
      operation: request.operation,
      status: "error",
      error,
      metadata: {
        durationMs: Date.now() - start,
        version,
      },
    };
  }
}

function isUsage(value: unknown): value is { promptTokens: number; completionTokens: number } {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { promptTokens?: unknown }).promptTokens === "number" &&
    typeof (value as { completionTokens?: unknown }).completionTokens === "number"
  );
}

export function buildRuntimeContextFromAuth(auth: {
  requestId?: string;
  channel?: RuntimeContext["channel"];
  userId: string;
  organizationId: string;
  workspaceId?: string;
  roles: readonly string[];
  locale?: string;
  activeModule?: string;
  activePage?: string;
  metadata?: JsonObject;
}): RuntimeContext {
  const context: RuntimeContext = {
    requestId: auth.requestId ?? crypto.randomUUID(),
    channel: auth.channel ?? "api",
    user: {
      userId: auth.userId,
      organizationId: auth.organizationId,
      workspaceId: auth.workspaceId,
      roles: auth.roles,
      locale: auth.locale,
      activeModule: auth.activeModule,
      activePage: auth.activePage,
    } as UserContext,
  };

  if (auth.metadata !== undefined) {
    return { ...context, metadata: auth.metadata };
  }

  return context;
}
