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
        if (query.userId && entry.userId !== query.userId) return false;
        if (query.types && !query.types.includes(entry.type)) return false;
        return true;
      })
      .slice(-(query.limit ?? 10))
      .reverse()
      .map((entry) => ({
        entry,
        score: 1,
      }));
  }

  async remember(input: string, output: string, context: ExecutionContext): Promise<void> {
    await this.append({
      id: `${context.requestId}-${Date.now()}`,
      type: "conversation",
      userId: context.identity.userId,
      workspaceId: context.identity.organizationId,
      content: JSON.stringify({ input, output }),
      occurredAt: new Date().toISOString(),
      metadata: { channel: context.channel },
    });
  }
}

export type { MemoryEntry, MemoryQuery, MemoryResult, MemoryRuntime } from "../../core/src/contracts/index.js";
export { MemoryRuntimeStoreAdapter } from "./adapter.js";
