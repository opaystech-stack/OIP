import type { MemoryStore, ConversationMemoryEntry } from "../../memory/src/index.js";
import type { RuntimeContext } from "../../core/src/index.js";
import type { ExecutionContext, MemoryEntry, MemoryQuery, MemoryResult, MemoryRuntime } from "../../core/src/contracts/index.js";

export class LegacyMemoryRuntimeAdapter implements MemoryRuntime {
  constructor(private readonly store: MemoryStore) {}

  async append(entry: MemoryEntry): Promise<void> {
    const conversation = parseConversation(entry.content);
    await this.store.append({
      requestId: entry.id,
      organizationId: entry.workspaceId,
      userId: entry.userId,
      ...(entry.threadId !== undefined ? { threadId: entry.threadId } : {}),
      input: conversation.input,
      response: conversation.response,
      occurredAt: entry.occurredAt,
      metadata: entry.metadata ?? {},
    });
  }

  async recall(query: MemoryQuery): Promise<readonly MemoryResult[]> {
    const context: RuntimeContext = {
      requestId: "recall",
      channel: "api",
      user: {
        userId: query.userId ?? "unknown",
        organizationId: query.workspaceId,
        roles: [],
        locale: "fr",
      },
      ...(query.threadId !== undefined ? { threadId: query.threadId } : {}),
    };

    const entries = await this.store.recent(context, query.limit ?? 10);

    return entries.map((entry) => ({
      entry: {
        id: entry.requestId,
        type: "conversation",
        workspaceId: entry.organizationId,
        userId: entry.userId,
        ...(entry.threadId !== undefined ? { threadId: entry.threadId } : {}),
        content: entry.input,
        occurredAt: entry.occurredAt,
        ...(entry.metadata !== undefined ? { metadata: entry.metadata } : {}),
      },
      score: 1,
    }));
  }

  async remember(_input: string, _output: string, _context: ExecutionContext): Promise<void> {
    // Not implemented for legacy stores.
  }
}

function parseConversation(content: string): { input: string; response: string } {
  try {
    const value = JSON.parse(content) as unknown;
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      return {
        input: String((value as { input?: unknown }).input ?? ""),
        response: String((value as { response?: unknown }).response ?? ""),
      };
    }
  } catch {
    // Legacy entries can be plain text.
  }
  return { input: content, response: "" };
}

export class MemoryRuntimeStoreAdapter implements MemoryStore {
  constructor(private readonly runtime: MemoryRuntime) {}

  async append(entry: ConversationMemoryEntry): Promise<void> {
    await this.runtime.append({
      id: entry.requestId,
      type: "conversation",
      workspaceId: entry.organizationId,
      userId: entry.userId,
      ...(entry.threadId !== undefined ? { threadId: entry.threadId } : {}),
      content: JSON.stringify({ input: entry.input, response: entry.response }),
      occurredAt: entry.occurredAt,
      metadata: entry.metadata ?? {},
    });
  }

  async recent(context: RuntimeContext, limit: number): Promise<readonly ConversationMemoryEntry[]> {
    const results = await this.runtime.recall({
      content: "",
      workspaceId: context.user.organizationId,
      userId: context.user.userId,
      ...(context.threadId !== undefined ? { threadId: context.threadId } : {}),
      limit,
    });

    return results.map((result) => {
      const parsed = parseConversation(result.entry.content);
      return {
        requestId: result.entry.id,
        organizationId: result.entry.workspaceId,
        userId: result.entry.userId ?? context.user.userId,
        ...(result.entry.threadId !== undefined ? { threadId: result.entry.threadId } : {}),
        input: parsed.input ?? "",
        response: parsed.response ?? "",
        occurredAt: result.entry.occurredAt,
        metadata: result.entry.metadata ?? {},
      };
    });
  }
}

export type { MemoryRuntime } from "../../core/src/contracts/index.js";
