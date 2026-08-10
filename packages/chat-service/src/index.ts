import type { ActionResult, JsonObject, RuntimeContext } from "../../core/src/index.js";
import type { LlmAdapter } from "../../llm-adapter/src/index.js";
import { LlmAdapterRuntime } from "../../llm-runtime/src/index.js";
import { LlmIntentInterpreter, OipRuntime } from "../../runtime/src/index.js";

export interface ChatRequest {
  readonly input: string;
  readonly context: RuntimeContext;
  readonly headers?: { readonly [key: string]: string };
}

export interface ChatResponse {
  readonly message: string;
  readonly plan: {
    readonly capabilityId: string;
    readonly confidence: number;
    readonly reason: string;
  };
  readonly action: ActionResult;
  readonly context: {
    readonly knowledgeCount: number;
    readonly metadata: JsonObject;
  };
}

export class ChatService {
  constructor(
    private readonly runtime: OipRuntime,
    private readonly llm: LlmAdapter,
  ) {}

  async handle(request: ChatRequest): Promise<ChatResponse> {
    return this.runtime.observability.trace(
      "chat.handle",
      {
        requestId: request.context.requestId,
        organizationId: request.context.user.organizationId,
        channel: request.context.channel,
      },
      async () => {
        const outcome = await this.runtime.handle({
          channel: request.context.channel,
          rawPayload: { text: request.input },
          text: request.input,
          metadata: { requestId: request.context.requestId },
          ...(request.headers !== undefined ? { headers: request.headers } : {}),
        }, new LlmIntentInterpreter(new LlmAdapterRuntime(this.llm)));
        const step = outcome.decision.type === "plan" ? outcome.decision.plan.steps[0] : undefined;
        const action = outcome.actions[0] ?? {
          capabilityId: step?.capabilityId ?? "oip.none",
          status: "rejected" as const,
          events: [],
        };

        return {
          message: outcome.response,
          plan: {
            capabilityId: step?.capabilityId ?? "oip.none",
            confidence: outcome.intention.confidence,
            reason: outcome.decision.type === "plan" ? outcome.decision.plan.explanation : outcome.response,
          },
          action,
          context: {
            knowledgeCount: outcome.context.knowledge?.length ?? 0,
            metadata: {
              channel: outcome.context.channel,
              locale: outcome.context.locale ?? "fr",
              memoryCount: outcome.context.memory?.length ?? 0,
            },
          },
        };
      },
    );
  }
}
