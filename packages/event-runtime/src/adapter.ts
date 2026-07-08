import type { EventPublisher, DomainEvent as LegacyDomainEvent, RuntimeContext } from "../../core/src/index.js";
import type { DomainEvent, EventRuntime } from "../../core/src/contracts/index.js";

export class EventRuntimePublisherAdapter implements EventPublisher {
  private readonly published: {
    readonly event: LegacyDomainEvent;
    readonly requestId: string;
    readonly organizationId: string;
  }[] = [];

  constructor(private readonly runtime: EventRuntime) {}

  async publish(event: LegacyDomainEvent, context: RuntimeContext): Promise<void> {
    const payload: Record<string, unknown> = { ...event.payload };
    payload["requestId"] = context.requestId;
    payload["organizationId"] = context.user.organizationId;

    this.published.push({
      event,
      requestId: context.requestId,
      organizationId: context.user.organizationId,
    });

    const enriched: DomainEvent = {
      type: event.type,
      payload: payload as import("../../core/src/contracts/common.js").JsonObject,
      occurredAt: event.occurredAt,
    };
    await this.runtime.publish(enriched);
  }

  list(): readonly {
    readonly event: LegacyDomainEvent;
    readonly requestId: string;
    readonly organizationId: string;
  }[] {
    return [...this.published];
  }
}
