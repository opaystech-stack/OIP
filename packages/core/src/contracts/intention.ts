import type { JsonValue } from "./common.js";

export interface Entity {
  readonly name: string;
  readonly value: JsonValue;
  readonly normalized?: JsonValue;
}

export interface Intention {
  readonly type: string;
  readonly confidence: number;
  readonly entities: readonly Entity[];
  readonly rawText: string;
  readonly goal: string;
}
