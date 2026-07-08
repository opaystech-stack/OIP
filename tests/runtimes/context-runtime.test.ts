import { InMemoryContextRuntime } from "../../packages/context-runtime/src/index.js";

function assertEqual(actual: unknown, expected: unknown): void {
  if (actual !== expected) {
    throw new Error(`Expected ${String(expected)}, received ${String(actual)}.`);
  }
}

const runtime = new InMemoryContextRuntime();

const tests = [
  {
    name: "ContextRuntime builds execution context from request and identity",
    run: async () => {
      const context = await runtime.build(
        {
          channel: "web",
          rawPayload: { text: "hello" },
          text: "hello",
          metadata: { requestId: "r1" },
        },
        {
          userId: "u1",
          organizationId: "org-1",
          roles: ["admin"],
        },
      );
      assertEqual(context.requestId, "r1");
      assertEqual(context.identity.userId, "u1");
      assertEqual(context.channel, "web");
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
