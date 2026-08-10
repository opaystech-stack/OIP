import { InMemoryPolicyRuntime } from "../../packages/policy-runtime/src/index.js";

function assertEqual(actual: unknown, expected: unknown): void {
  if (actual !== expected) {
    throw new Error(`Expected ${String(expected)}, received ${String(actual)}.`);
  }
}

const runtime = new InMemoryPolicyRuntime();

const tests = [
  {
    name: "PolicyRuntime denies requests without an explicit policy",
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
      assertEqual(result.effect, "deny");
    },
  },
  {
    name: "PolicyRuntime allows a registered role-bound action",
    run: async () => {
      await runtime.registerPolicy({
        id: "inventory-add",
        description: "Inventory additions require a manager.",
        resource: "inventory",
        action: "add",
        rules: [{ rolesAll: ["inventory.manager"] }],
      });
      const result = await runtime.evaluate({
        subject: { userId: "u2", organizationId: "org-1", roles: ["inventory.manager"] },
        resource: "inventory", action: "add",
      }, {
        requestId: "r2", identity: { userId: "u2", organizationId: "org-1", roles: ["inventory.manager"] }, channel: "web",
      });
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
