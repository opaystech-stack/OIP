import type { JsonObject, RuntimeContext } from "../../core/src/index.js";

export interface ConversationMemoryEntry {
  readonly requestId: string;
  readonly organizationId: string;
  readonly userId: string;
  readonly input: string;
  readonly response: string;
  readonly occurredAt: string;
  readonly metadata?: JsonObject;
}

export interface MemoryStore {
  append(entry: ConversationMemoryEntry): Promise<void>;
  recent(context: RuntimeContext, limit: number): Promise<readonly ConversationMemoryEntry[]>;
}

export class InMemoryStore implements MemoryStore {
  private readonly entries: ConversationMemoryEntry[] = [];

  async append(entry: ConversationMemoryEntry): Promise<void> {
    this.entries.push(entry);
  }

  async recent(context: RuntimeContext, limit: number): Promise<readonly ConversationMemoryEntry[]> {
    return this.entries
      .filter(
        (entry) =>
          entry.organizationId === context.user.organizationId &&
          entry.userId === context.user.userId,
      )
      .slice(-limit)
      .reverse();
  }
}
