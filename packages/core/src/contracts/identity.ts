import type { JsonObject } from "./common.js";

export interface IdentityContext {
  readonly userId: string;
  readonly organizationId: string;
  readonly workspaceId: string;
  readonly roles: readonly string[];
  readonly scopes: readonly string[];
  readonly permissions: readonly string[];
  readonly metadata?: JsonObject;
}

export interface Workspace {
  readonly id: string;
  readonly name: string;
  readonly plugins: readonly string[];
  readonly locale: string;
  readonly settings: JsonObject;
}
