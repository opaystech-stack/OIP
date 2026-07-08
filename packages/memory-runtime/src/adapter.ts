import type { MemoryStore, ConversationMemoryEntry } from "../../memory/src/index.js";
import type { RuntimeContext } from "../../core/src/index.js";
import type { ExecutionContext, MemoryEntry, MemoryQuery, MemoryResult, MemoryRuntime } from "../../core/src/contracts/index.js";

export class LegacyMemoryRuntimeAdapter implements MemoryRuntime {
  constructor(private readonly store: MemoryStore) {}

  async append(entry: MemoryEntry): Promise<void> {
    await this.store.append({
      requestId: entry.id,
      organizationId: entry.workspaceId,
      userId: entry.userId,
      input: entry.content ?? "",
      response: "",
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
    };

    const entries = await this.store.recent(context, query.limit ?? 10);

    return entries.map((entry) => ({
      entry: {
        id: entry.requestId,
        type: "conversation",
        workspaceId: entry.organizationId,
        userId: entry.userId,
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

export class MemoryRuntimeStoreAdapter implements MemoryStore {
  constructor(private readonly runtime: MemoryRuntime) {}

  async append(entry: ConversationMemoryEntry): Promise<void> {
    await this.runtime.append({
      id: entry.requestId,
      type: "conversation",
      workspaceId: entry.organizationId,
      userId: entry.userId,
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
      limit,
    });

    return results.map((result) => {
      const parsed = JSON.parse(result.entry.content) as { input?: string; response?: string };
      return {
        requestId: result.entry.id,
        organizationId: result.entry.workspaceId,
        userId: result.entry.userId ?? context.user.userId,
        input: parsed.input ?? "",
        response: parsed.response ?? "",
        occurredAt: result.entry.occurredAt,
        metadata: result.entry.metadata ?? {},
      };
    });
  }
}

export type { MemoryRuntime } from "../../core/src/contracts/index.js";