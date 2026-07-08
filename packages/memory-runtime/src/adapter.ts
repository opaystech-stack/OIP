import type { MemoryStore, ConversationMemoryEntry } from "../../memory/src/index.js";
import type { RuntimeContext } from "../../core/src/index.js";
import type { MemoryRuntime } from "../../core/src/contracts/index.js";

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
