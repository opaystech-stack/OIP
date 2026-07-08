import type { JsonObject, RuntimeContext } from "../../core/src/index.js";
import type { BuiltContext, ContextBuilder } from "../../context-builder/src/index.js";
import type { ContextRuntime, ExecutionContext, IdentityContext, InboundRequest } from "../../core/src/contracts/index.js";

export class ContextRuntimeBuilderAdapter implements ContextBuilder {
  constructor(private readonly runtime: ContextRuntime) {}

  async build(input: string, runtimeContext: RuntimeContext): Promise<BuiltContext> {
    const identity: IdentityContext = {
      userId: runtimeContext.user.userId,
      organizationId: runtimeContext.user.organizationId,
      roles: runtimeContext.user.roles,
      locale: runtimeContext.user.locale,
      ...(runtimeContext.user.activeModule !== undefined
        ? { activeModule: runtimeContext.user.activeModule }
        : {}),
      ...(runtimeContext.user.activePage !== undefined
        ? { activePage: runtimeContext.user.activePage }
        : {}),
    };

    const request: InboundRequest = {
      channel: runtimeContext.channel,
      rawPayload: { text: input },
      text: input,
      metadata: {
        requestId: runtimeContext.requestId,
        ...runtimeContext.metadata,
      } as JsonObject,
    };

    const executionContext = await this.runtime.build(request, identity);
    return adaptExecutionContext(executionContext, runtimeContext);
  }
}

function adaptExecutionContext(context: ExecutionContext, runtimeContext: RuntimeContext): BuiltContext {
  return {
    runtime: runtimeContext,
    knowledge: context.knowledge?.map((result) => ({
      sourceId: result.sourceId,
      title: result.title,
      content: result.content,
      score: result.score,
      metadata: result.metadata ?? {},
    })) ?? [],
    metadata: {
      channel: context.channel,
      locale: context.locale ?? "fr",
      activeModule: runtimeContext.user.activeModule ?? null,
      activePage: runtimeContext.user.activePage ?? null,
      ...context.metadata,
    },
    memory: context.memory?.map((result) => {
      const parsed = parseConversationContent(result.entry.content);
      return {
        input: parsed.input,
        response: parsed.response,
        occurredAt: result.entry.occurredAt,
      };
    }) ?? [],
  };
}

function parseConversationContent(content: string): { input: string; response: string } {
  try {
    const parsed = JSON.parse(content) as unknown;
    if (isObject(parsed)) {
      return {
        input: String(parsed.input ?? ""),
        response: String(parsed.response ?? ""),
      };
    }
  } catch {
    // Ignore parse failure.
  }

  return { input: content, response: "" };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export type { ContextRuntime, ExecutionContext } from "../../core/src/contracts/index.js";
