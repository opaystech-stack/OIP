import type { JsonObject } from "./common.js";
import type { IdentityContext } from "./identity.js";
import type { KnowledgeResult } from "./knowledge.js";
import type { MemoryResult } from "./memory.js";

export interface ExecutionContext {
  readonly requestId: string;
  readonly identity: IdentityContext;
  readonly channel: "web" | "mobile" | "whatsapp" | "telegram" | "api" | "voice";
  readonly locale?: string;
  readonly metadata?: JsonObject;
  readonly memory?: readonly MemoryResult[];
  readonly knowledge?: readonly KnowledgeResult[];
}
