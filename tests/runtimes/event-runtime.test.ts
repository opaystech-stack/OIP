import { InMemoryEventRuntime } from "../../packages/event-runtime/src/index.js";

function assertEqual(actual: unknown, expected: unknown): void {
  if (actual !== expected) {
    throw new Error(`Expected ${String(expected)}, received ${String(actual)}.`);
  }
}

const runtime = new InMemoryEventRuntime();
const received: string[] = [];

await runtime.subscribe({ types: ["order.created"] }, async (event) => {
  received.push(event.type);
});

const tests = [
  {
    name: "EventRuntime delivers matching events",
    run: async () => {
      await runtime.publish({
        type: "order.created",
        payload: { id: "1" },
        occurredAt: new Date().toISOString(),
      });
      assertEqual(received.length, 1);
      assertEqual(received[0], "order.created");
    },
  },
  {
    name: "EventRuntime ignores non-matching events",
    run: async () => {
      await runtime.publish({
        type: "order.updated",
        payload: { id: "2" },
        occurredAt: new Date().toISOString(),
      });
      assertEqual(received.length, 1);
    },
  },
];

async function runTests(): Promise<void> {
  for (const test of tests) {
    await test.run();
    console.log(`ok - ${test.name}`);
  }
}

runTests();
