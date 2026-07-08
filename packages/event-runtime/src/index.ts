import type {
  DomainEvent,
  EventFilter,
  EventHandler,
  EventRuntime,
  EventSubscription,
} from "../../core/src/contracts/index.js";

export class InMemoryEventRuntime implements EventRuntime {
  private readonly subscriptions = new Map<number, { filter: EventFilter; handler: EventHandler }>();
  private nextId = 1;

  async publish(event: DomainEvent): Promise<void> {
    const promises: Promise<unknown>[] = [];

    for (const { filter, handler } of Array.from(this.subscriptions.values())) {
      if (matchesFilter(event, filter)) {
        promises.push(Promise.resolve(handler(event)));
      }
    }

    await Promise.all(promises);
  }

  async subscribe(filter: EventFilter, handler: EventHandler): Promise<EventSubscription> {
    const id = this.nextId++;
    this.subscriptions.set(id, { filter, handler });

    return {
      unsubscribe: () => {
        this.subscriptions.delete(id);
      },
    };
  }
}

function matchesFilter(event: DomainEvent, filter: EventFilter): boolean {
  if (filter.types && !filter.types.includes(event.type)) {
    return false;
  }

  return true;
}

export type { DomainEvent, EventFilter, EventHandler, EventRuntime, EventSubscription } from "../../core/src/contracts/index.js";
