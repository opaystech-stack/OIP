import type { AuditLogger, AuditRecord } from "../../core/src/index.js";

export class InMemoryAuditLog implements AuditLogger {
  private readonly records: AuditRecord[] = [];

  async record(entry: AuditRecord): Promise<void> {
    this.records.push(entry);
  }

  list(): readonly AuditRecord[] {
    return [...this.records];
  }
}
