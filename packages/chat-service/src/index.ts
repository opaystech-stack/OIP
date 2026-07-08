import type { ActionResult, JsonObject, RuntimeContext } from "../../core/src/index.js";
import type { BuiltContext } from "../../context-builder/src/index.js";
import type { LlmAdapter } from "../../llm-adapter/src/index.js";
import { OipRuntime } from "../../runtime/src/index.js";

export interface ChatRequest {
  readonly input: string;
  readonly context: RuntimeContext;
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
        const builtContext = await this.runtime.buildContext(request.input, request.context);
        const planner = this.runtime.createPlanner(this.llm);
        const plan = await planner.plan(createPlannerInput(request.input, builtContext));
        const action = await this.runtime.execute(plan, request.context);
        const message = createUserMessage(action);

        await this.runtime.memory.append({
          requestId: request.context.requestId,
          organizationId: request.context.user.organizationId,
          userId: request.context.user.userId,
          input: request.input,
          response: message,
          occurredAt: new Date().toISOString(),
          metadata: {
            capabilityId: plan.capabilityId,
            actionStatus: action.status,
          },
        });

        return {
          message,
          plan: {
            capabilityId: plan.capabilityId,
            confidence: plan.confidence,
            reason: plan.reason,
          },
          action,
          context: {
            knowledgeCount: builtContext.knowledge.length,
            metadata: {
              ...builtContext.metadata,
              memoryCount: builtContext.memory.length,
            },
          },
        };
      },
    );
  }
}

function createPlannerInput(input: string, context: BuiltContext): string {
  return JSON.stringify({
    input,
    runtime: context.metadata,
    knowledge: context.knowledge.map((item) => ({
      title: item.title,
      content: item.content,
      score: item.score,
      sourceId: item.sourceId,
    })),
    memory: context.memory,
  });
}

function createUserMessage(action: ActionResult): string {
  if (action.status === "rejected") {
    return "Je ne peux pas executer cette action avec le contexte actuel. Une validation ou permission manque.";
  }

  return "Action executee avec succes.";
}
