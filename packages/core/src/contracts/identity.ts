import type { JsonObject } from "./common.js";

export interface IdentityContext {
  readonly userId: string;
  readonly organizationId: string;
  readonly roles: readonly string[];
  readonly locale?: string;
  readonly activeModule?: string;
  readonly activePage?: string;
  readonly metadata?: JsonObject;
}

export interface Workspace {
  readonly id: string;
  readonly name: string;
  readonly plugins: readonly string[];
  readonly settings?: JsonObject;
}
