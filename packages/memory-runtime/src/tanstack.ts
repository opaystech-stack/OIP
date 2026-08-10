import {
  memoryMiddleware,
  type MemoryAdapter,
  type MemoryScope,
  type RecallResult,
} from "@tanstack/ai-memory";
import type { ChatMiddleware, ChatMiddlewareContext } from "@tanstack/ai";
import type {
  ExecutionContext,
  MemoryEntry,
  MemoryQuery,
  MemoryResult,
  MemoryRuntime,
} from "../../core/src/contracts/index.js";
import type { RuntimeContext } from "../../core/src/index.js";
import type { ConversationMemoryEntry, MemoryStore } from "../../memory/src/index.js";

export interface TanStackMemoryRuntimeOptions {
  readonly namespace?: string;
}

/**
 * OIP adapter around TanStack's MemoryAdapter contract.
 *
 * TanStack owns recall/save, ranking and provider persistence. OIP owns the
 * trusted scope boundary and refuses any call without a tenant, user and
 * validated conversation thread.
 */
export class TanStackMemoryRuntime implements MemoryRuntime {
  readonly adapter: MemoryAdapter;
  private readonly namespace: string;

  constructor(adapter: MemoryAdapter, options: TanStackMemoryRuntimeOptions = {}) {
    this.adapter = adapter;
    this.namespace = options.namespace ?? "oip";
  }

  async append(entry: MemoryEntry): Promise<void> {
    const scope = memoryScopeFromMemoryEntry(entry, this.namespace);
    await this.persist(scope, parseConversation(entry.content));
  }

  async recall(query: MemoryQuery): Promise<readonly MemoryResult[]> {
    const scope = memoryScopeFromMemoryQuery(query, this.namespace);
    const result = await this.adapter.recall(scope, query.content);
    return toMemoryResults(result, scope, this.adapter.id, query.limit);
  }

  async remember(context: ExecutionContext, input: string, output: string): Promise<void> {
    const scope = memoryScopeFromExecutionContext(context, this.namespace);
    await this.persist(scope, { user: input, assistant: output });
  }

  async recallForContext(
    context: ExecutionContext,
    content: string,
    limit?: number,
  ): Promise<readonly MemoryResult[]> {
    const scope = memoryScopeFromExecutionContext(context, this.namespace);
    const result = await this.adapter.recall(scope, content);
    return toMemoryResults(result, scope, this.adapter.id, limit);
  }

  private async persist(
    scope: MemoryScope,
    turn: { readonly user: string; readonly assistant: string },
  ): Promise<void> {
    const receipts = await this.adapter.save(scope, turn);
    if (receipts.length === 0) {
      throw new Error("TanStack memory save returned no receipt.");
    }
    const failed = receipts.find((receipt) => !receipt.ok);
    if (failed) {
      throw new Error(`TanStack memory save failed: ${failed.error ?? "unknown provider error"}`);
    }
  }
}

/**
 * Compatibility adapter for existing OIP MemoryStore callers.
 * The legacy context must carry the same trusted thread id used by TanStack.
 */
export class TanStackMemoryStoreAdapter implements MemoryStore {
  constructor(private readonly runtime: TanStackMemoryRuntime) {}

  async append(entry: ConversationMemoryEntry): Promise<void> {
    if (!entry.threadId) {
      throw new Error("TanStack memory requires a trusted validated threadId in MemoryStore entries.");
    }
    await this.runtime.append({
      id: entry.requestId,
      type: "conversation",
      workspaceId: entry.organizationId,
      userId: entry.userId,
      threadId: entry.threadId,
      content: JSON.stringify({ input: entry.input, response: entry.response }),
      occurredAt: entry.occurredAt,
      ...(entry.metadata !== undefined ? { metadata: entry.metadata } : {}),
    });
  }

  async recent(context: RuntimeContext, limit: number): Promise<readonly ConversationMemoryEntry[]> {
    if (!context.threadId) {
      throw new Error("TanStack memory requires a trusted validated threadId in RuntimeContext.");
    }
    const executionContext: ExecutionContext = {
      requestId: context.requestId,
      threadId: context.threadId,
      identity: {
        userId: context.user.userId,
        organizationId: context.user.organizationId,
        roles: context.user.roles,
        ...(context.user.locale !== undefined ? { locale: context.user.locale } : {}),
      },
      channel: context.channel,
      ...(context.metadata !== undefined ? { metadata: context.metadata } : {}),
    };
    const results = await this.runtime.recallForContext(executionContext, "", limit);
    return results.map((result) => {
      const parsed = parseConversation(result.entry.content);
      return {
        requestId: result.entry.id,
        organizationId: result.entry.workspaceId,
        userId: result.entry.userId,
        ...(result.entry.threadId !== undefined ? { threadId: result.entry.threadId } : {}),
        input: parsed.user,
        response: parsed.assistant,
        occurredAt: result.entry.occurredAt,
        metadata: result.entry.metadata ?? {},
      };
    });
  }
}

export interface TanStackMemoryMiddlewareOptions<TContext = unknown> {
  readonly adapter: MemoryAdapter;
  /** Resolve a trusted server-side OIP context; never copy identity from chat input. */
  readonly executionContext: (
    context: ChatMiddlewareContext<TContext>,
  ) => ExecutionContext | Promise<ExecutionContext>;
  readonly namespace?: string;
}

/**
 * Compose TanStack's lifecycle middleware while deriving its scope from OIP's
 * authenticated ExecutionContext. The TanStack chat context's threadId is not
 * used as an authorization claim.
 */
export function createTanStackMemoryMiddleware<TContext = unknown>(
  options: TanStackMemoryMiddlewareOptions<TContext>,
): ChatMiddleware<TContext> {
  const middleware = memoryMiddleware({
    adapter: options.adapter,
    scope: async (chatContext) => {
      const executionContext = await options.executionContext(
        chatContext as ChatMiddlewareContext<TContext>,
      );
      return memoryScopeFromExecutionContext(executionContext, options.namespace ?? "oip");
    },
  });

  return middleware as ChatMiddleware<TContext>;
}

export function memoryScopeFromExecutionContext(
  context: ExecutionContext,
  namespace = "oip",
): MemoryScope {
  return {
    tenantId: requireText(context.identity.organizationId, "tenantId"),
    userId: requireText(context.identity.userId, "userId"),
    threadId: requireText(context.threadId, "trusted validated threadId"),
    namespace: requireText(namespace, "memory namespace"),
  };
}

function memoryScopeFromMemoryEntry(entry: MemoryEntry, namespace: string): MemoryScope {
  return {
    tenantId: requireText(entry.workspaceId, "tenantId"),
    userId: requireText(entry.userId, "userId"),
    threadId: requireText(entry.threadId, "trusted validated threadId"),
    namespace: requireText(namespace, "memory namespace"),
  };
}

function memoryScopeFromMemoryQuery(query: MemoryQuery, namespace: string): MemoryScope {
  return {
    tenantId: requireText(query.workspaceId, "tenantId"),
    userId: requireText(query.userId, "userId"),
    threadId: requireText(query.threadId, "trusted validated threadId"),
    namespace: requireText(namespace, "memory namespace"),
  };
}

function toMemoryResults(
  result: RecallResult,
  scope: MemoryScope,
  adapterId: string,
  limit?: number,
): readonly MemoryResult[] {
  const occurredAt = new Date().toISOString();
  const fragments = result.fragments ?? [];
  if (fragments.length > 0) {
    return fragments.slice(0, limit ?? fragments.length).map((fragment, index) => ({
      entry: {
        id: `tanstack:${adapterId}:${fragment.source}:${index}`,
        type: "conversation",
        workspaceId: scope.tenantId as string,
        userId: scope.userId as string,
        threadId: scope.threadId,
        content: fragment.text,
        occurredAt,
        metadata: {
          source: fragment.source,
          adapter: adapterId,
        },
      },
      score: 1,
    }));
  }

  if (!result.systemPrompt.trim()) return [];
  return [{
    entry: {
      id: `tanstack:${adapterId}:rendered-memory`,
      type: "conversation",
      workspaceId: scope.tenantId as string,
      userId: scope.userId as string,
      threadId: scope.threadId,
      content: result.systemPrompt,
      occurredAt,
      metadata: {
        source: "tanstack.systemPrompt",
        adapter: adapterId,
      },
    },
    score: 1,
  }];
}

function parseConversation(content: string): { user: string; assistant: string } {
  try {
    const parsed = JSON.parse(content) as unknown;
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
      const value = parsed as { input?: unknown; response?: unknown };
      return {
        user: typeof value.input === "string" ? value.input : content,
        assistant: typeof value.response === "string" ? value.response : "",
      };
    }
  } catch {
    // Plain-text legacy memory entries remain valid user turns.
  }
  return { user: content, assistant: "" };
}

function requireText(value: string | undefined, label: string): string {
  if (!value || value.trim().length === 0) {
    throw new Error(`TanStack memory requires ${label}.`);
  }
  return value;
}

export type { MemoryAdapter, MemoryScope } from "@tanstack/ai-memory";
export type { MemoryRuntime } from "../../core/src/contracts/index.js";
