import type { JsonObject } from "./common.js";

export interface DomainEvent {
  readonly id: string;
  readonly type: string;
  readonly payload: JsonObject;
  readonly workspaceId: string;
  readonly requestId: string;
  readonly occurredAt: string;
  readonly correlationId?: string;
}

export interface EventFilter {
  readonly types?: readonly string[];
  readonly workspaceId?: string;
  readonly requestId?: string;
}

export interface EventSubscription {
  readonly unsubscribe: () => void;
}

export interface EventHandler {
  (event: DomainEvent): void | Promise<void>;
}
