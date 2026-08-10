import type {
  ExecutionContext,
  MemoryEntry,
  MemoryQuery,
  MemoryResult,
  MemoryRuntime,
} from "../../core/src/contracts/index.js";

export class InMemoryMemoryRuntime implements MemoryRuntime {
  private readonly entries: MemoryEntry[] = [];

  async append(entry: MemoryEntry): Promise<void> {
    this.entries.push(entry);
  }

  async recall(query: MemoryQuery): Promise<readonly MemoryResult[]> {
    return this.entries
      .filter((entry) => {
        if (entry.workspaceId !== query.workspaceId) return false;
        if (query.threadId && entry.threadId !== query.threadId) return false;
        if (query.userId && entry.userId !== query.userId && entry.type !== "organization") return false;
        if (query.types && !query.types.includes(entry.type)) return false;
        return true;
      })
      .map((entry) => ({
        entry,
        score: relevance(query.content, entry.content),
      }))
      .sort((left, right) => right.score - left.score || right.entry.occurredAt.localeCompare(left.entry.occurredAt))
      .slice(0, query.limit ?? 10);
  }

  async remember(input: string, output: string, context: ExecutionContext): Promise<void> {
    await this.append({
      id: `${context.requestId}-${Date.now()}`,
      type: "conversation",
      userId: context.identity.userId,
      workspaceId: context.identity.organizationId,
      ...(context.threadId !== undefined ? { threadId: context.threadId } : {}),
      content: JSON.stringify({ input, output }),
      occurredAt: new Date().toISOString(),
      metadata: { channel: context.channel },
    });
  }
}

function relevance(query: string, content: string): number {
  const terms = query.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((term) => term.length > 1);
  if (terms.length === 0) return 1;
  const haystack = content.toLowerCase();
  return terms.filter((term) => haystack.includes(term)).length / terms.length;
}

export type { MemoryEntry, MemoryQuery, MemoryResult, MemoryRuntime } from "../../core/src/contracts/index.js";
export { LegacyMemoryRuntimeAdapter, MemoryRuntimeStoreAdapter } from "./adapter.js";
export {
  TanStackMemoryRuntime,
  TanStackMemoryStoreAdapter,
  createTanStackMemoryMiddleware,
  memoryScopeFromExecutionContext,
} from "./tanstack.js";
export type {
  MemoryAdapter,
  MemoryScope,
  TanStackMemoryMiddlewareOptions,
  TanStackMemoryRuntimeOptions,
} from "./tanstack.js";
