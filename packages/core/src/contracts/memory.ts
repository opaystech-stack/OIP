import type { JsonObject } from "./common.js";

export type MemoryType = "conversation" | "user" | "organization" | "episodic";

export interface MemoryEntry {
  readonly id: string;
  readonly type: MemoryType;
  readonly workspaceId: string;
  readonly userId?: string;
  readonly content: string;
  readonly metadata?: JsonObject;
  readonly occurredAt: string;
}

export interface MemoryQuery {
  readonly content: string;
  readonly types?: readonly MemoryType[];
  readonly workspaceId: string;
  readonly userId?: string;
  readonly limit?: number;
}

export interface MemoryResult {
  readonly entry: MemoryEntry;
  readonly score: number;
}
