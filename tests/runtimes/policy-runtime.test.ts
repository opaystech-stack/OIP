import { InMemoryPolicyRuntime } from "../../packages/policy-runtime/src/index.js";

function assertEqual(actual: unknown, expected: unknown): void {
  if (actual !== expected) {
    throw new Error(`Expected ${String(expected)}, received ${String(actual)}.`);
  }
}

const runtime = new InMemoryPolicyRuntime();

const tests = [
  {
    name: "PolicyRuntime allows requests by default",
    run: async () => {
      const result = await runtime.evaluate(
        {
          subject: {
            userId: "u1",
            organizationId: "org-1",
            roles: [],
          },
          resource: "inventory",
          action: "add",
        },
        {
          requestId: "r1",
          identity: {
            userId: "u1",
            organizationId: "org-1",
            roles: [],
          },
          channel: "web",
        },
      );
      assertEqual(result.effect, "allow");
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
