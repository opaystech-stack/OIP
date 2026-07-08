import type { JsonObject } from "./common.js";
import type { IdentityContext } from "./identity.js";
import type { KnowledgeResult } from "./knowledge.js";
import type { MemoryResult } from "./memory.js";

export interface ExecutionContext {
  readonly requestId: string;
  readonly workspaceId: string;
  readonly identity: IdentityContext;
  readonly channel: string;
  readonly locale: string;
  readonly memory: readonly MemoryResult[];
  readonly knowledge: readonly KnowledgeResult[];
  readonly metadata: JsonObject;
}
