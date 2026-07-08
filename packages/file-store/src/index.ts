import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { AuditLogger, AuditRecord, DomainEvent, EventPublisher, RuntimeContext } from "../../core/src/index.js";
import type { ConversationMemoryEntry, MemoryStore } from "../../memory/src/index.js";

export class JsonFileCollection<T> {
  constructor(private readonly filePath: string) {}

  async append(entry: T): Promise<void> {
    const entries = await this.readAll();
    entries.push(entry);
    await this.writeAll(entries);
  }

  async readAll(): Promise<T[]> {
    try {
      const raw = await readFile(this.filePath, "utf8");
      const parsed = JSON.parse(raw) as unknown;

      if (!Array.isArray(parsed)) {
        throw new Error(`JSON file does not contain an array: ${this.filePath}`);
      }

      return parsed as T[];
    } catch (error) {
      if (isFileMissing(error)) {
        return [];
      }

      throw error;
    }
  }

  private async writeAll(entries: readonly T[]): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, `${JSON.stringify(entries, null, 2)}\n`, "utf8");
  }
}

export class JsonFileMemoryStore implements MemoryStore {
  private readonly collection: JsonFileCollection<ConversationMemoryEntry>;

  constructor(filePath: string) {
    this.collection = new JsonFileCollection(filePath);
  }

  append(entry: ConversationMemoryEntry): Promise<void> {
    return this.collection.append(entry);
  }

  async recent(context: RuntimeContext, limit: number): Promise<readonly ConversationMemoryEntry[]> {
    const entries = await this.collection.readAll();

    return entries
      .filter(
        (entry) =>
          entry.organizationId === context.user.organizationId &&
          entry.userId === context.user.userId,
      )
      .slice(-limit)
      .reverse();
  }
}

export class JsonFileAuditLog implements AuditLogger {
  private readonly collection: JsonFileCollection<AuditRecord>;

  constructor(filePath: string) {
    this.collection = new JsonFileCollection(filePath);
  }

  record(entry: AuditRecord): Promise<void> {
    return this.collection.append(entry);
  }

  list(): Promise<readonly AuditRecord[]> {
    return this.collection.readAll();
  }
}

export interface PersistedEventRecord {
  readonly event: DomainEvent;
  readonly requestId: string;
  readonly organizationId: string;
}

export class JsonFileEventBus implements EventPublisher {
  private readonly collection: JsonFileCollection<PersistedEventRecord>;

  constructor(filePath: string) {
    this.collection = new JsonFileCollection(filePath);
  }

  publish(event: DomainEvent, context: RuntimeContext): Promise<void> {
    return this.collection.append({
      event,
      requestId: context.requestId,
      organizationId: context.user.organizationId,
    });
  }

  list(): Promise<readonly PersistedEventRecord[]> {
    return this.collection.readAll();
  }
}

function isFileMissing(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}
