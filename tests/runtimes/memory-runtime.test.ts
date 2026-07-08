import { InMemoryMemoryRuntime } from "../../packages/memory-runtime/src/index.js";

function assertEqual(actual: unknown, expected: unknown): void {
  if (actual !== expected) {
    throw new Error(`Expected ${String(expected)}, received ${String(actual)}.`);
  }
}

const runtime = new InMemoryMemoryRuntime();

const tests = [
  {
    name: "MemoryRuntime stores and recalls entries",
    run: async () => {
      await runtime.append({
        id: "m1",
        type: "conversation",
        workspaceId: "ws-1",
        userId: "u1",
        content: "hello",
        occurredAt: new Date().toISOString(),
      });

      const results = await runtime.recall({
        content: "hello",
        workspaceId: "ws-1",
        userId: "u1",
        limit: 10,
      });

      assertEqual(results.length, 1);
      assertEqual(results[0]?.entry.content, "hello");
    },
  },
  {
    name: "MemoryRuntime filters by workspace",
    run: async () => {
      const results = await runtime.recall({
        content: "hello",
        workspaceId: "ws-2",
        userId: "u1",
        limit: 10,
      });

      assertEqual(results.length, 0);
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
