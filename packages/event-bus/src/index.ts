import type { DomainEvent, EventPublisher, RuntimeContext } from "../../core/src/index.js";

export interface PublishedEvent {
  readonly event: DomainEvent;
  readonly requestId: string;
  readonly organizationId: string;
}

export class InMemoryEventBus implements EventPublisher {
  private readonly published: PublishedEvent[] = [];

  async publish(event: DomainEvent, context: RuntimeContext): Promise<void> {
    this.published.push({
      event,
      requestId: context.requestId,
      organizationId: context.user.organizationId,
    });
  }

  list(): readonly PublishedEvent[] {
    return [...this.published];
  }
}
