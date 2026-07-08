import { RuleBasedDecisionRuntime } from "../../packages/decision-runtime/src/index.js";

function assertEqual(actual: unknown, expected: unknown): void {
  if (actual !== expected) {
    throw new Error(`Expected ${String(expected)}, received ${String(actual)}.`);
  }
}

const capabilities = [
  {
    id: "commerce.inventory.add",
    description: "Add items to inventory",
    parameters: [
      { name: "itemName", type: "string" as const, required: true, description: "" },
      { name: "quantity", type: "number" as const, required: true, description: "" },
    ],
    requiredRoles: ["inventory.manager"],
    confirmationLevel: "medium" as const,
    sideEffects: [],
    emits: [],
  },
];

const runtime = new RuleBasedDecisionRuntime(capabilities);

const tests = [
  {
    name: "DecisionRuntime rejects unknown intents",
    run: async () => {
      const result = await runtime.decide(
        {
          type: "unknown",
          confidence: 1,
          entities: [],
          rawText: "do something else",
          goal: "unknown",
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
      assertEqual(result.type, "reject");
    },
  },
  {
    name: "DecisionRuntime plans matching intents",
    run: async () => {
      const result = await runtime.decide(
        {
          type: "action",
          confidence: 1,
          entities: [
            { name: "itemName", value: "ciment" },
            { name: "quantity", value: 10 },
          ],
          rawText: "add ciment",
          goal: "Add items to inventory",
        },
        {
          requestId: "r2",
          identity: {
            userId: "u1",
            organizationId: "org-1",
            roles: [],
          },
          channel: "web",
        },
      );
      assertEqual(result.type, "plan");
      if (result.type === "plan") {
        assertEqual(result.plan.steps.length, 1);
        assertEqual(result.plan.steps[0]?.capabilityId, "commerce.inventory.add");
      }
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
