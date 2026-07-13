import { HqRoutingDecisionRuntime } from "../packages/decision-runtime/src/hq-router.js";
import { HqActionRegistry } from "../packages/hq-connector/src/index.js";
import type { ExecutionContext, Intention } from "../packages/core/src/contracts/index.js";

function fakeRegistry(actions: Array<{ id: string; description?: string; inputSchema?: Record<string, unknown>; requiredRoles?: readonly string[] }>): HqActionRegistry {
  const fakeConnector = {
    listCapabilities: async () =>
      actions.map((a) => ({
        id: a.id,
        description: a.description,
        inputSchema: a.inputSchema,
        requiredRoles: a.requiredRoles,
      })),
    executeCapability: async () => ({ status: "completed", httpStatus: 200, data: {} } as never),
  } as unknown as import("../packages/hq-connector/src/index.js").HqConnector;
  return new HqActionRegistry({ connector: fakeConnector });
}

function intent(goal: string, rawText: string, entities: Array<{ name: string; value: unknown }> = []): Intention {
  return {
    goal,
    rawText,
    type: goal,
    confidence: 0.9,
    entities: entities.map((e) => ({
      name: e.name,
      value: e.value as import("../packages/core/src/contracts/index.js").JsonValue,
    })),
  };
}

const context: ExecutionContext = {
  requestId: "req-1",
  identity: { userId: "u1", organizationId: "org-1", workspaceId: "ws-1", roles: ["user"], scopes: [], permissions: [] },
  workspace: { id: "ws-1", name: "Test", plugins: [], locale: "fr", settings: {} },
  channel: "web",
  locale: "fr",
} as unknown as ExecutionContext;

const tests: readonly { readonly name: string; readonly run: () => Promise<void> }[] = [
  {
    name: "routes 'create task' to create_task capability",
    run: async () => {
      const registry = fakeRegistry([{ id: "create_task", description: "Create a task" }, { id: "create_lead" }]);
      const router = new HqRoutingDecisionRuntime({ registry, routingThreshold: 0.4 });
      const result = await router.decide(intent("create task", "créer une tâche pour Patrick"), context);

      assertEqual(result.type, "plan");
      if (result.type === "plan") {
        assertEqual(result.plan.steps[0]?.capabilityId, "create_task");
        assertEqual(result.plan.steps[0]?.type, "action");
      }
    },
  },
  {
    name: "extracts entity arguments from schema properties",
    run: async () => {
      const registry = fakeRegistry([
        {
          id: "create_task",
          description: "Create a task",
          inputSchema: { properties: { title: {}, priority: {} } },
        },
      ]);
      const router = new HqRoutingDecisionRuntime({ registry });
      const result = await router.decide(
        intent("create task", "tâche urgente", [
          { name: "title", value: "Acheter du ciment" },
          { name: "priority", value: "high" },
          { name: "extra", value: "ignored" },
        ]),
        context,
      );

      assertEqual(result.type, "plan");
      if (result.type === "plan") {
        assertEqual(result.plan.steps[0]?.arguments.title, "Acheter du ciment");
        assertEqual(result.plan.steps[0]?.arguments.priority, "high");
        assertEqual(result.plan.steps[0]?.arguments.extra, undefined);
      }
    },
  },
  {
    name: "asks clarification when several capabilities match equally",
    run: async () => {
      const registry = fakeRegistry([
        { id: "create_task", description: "Create a task" },
        { id: "create_project", description: "Create a project" },
      ]);
      const router = new HqRoutingDecisionRuntime({ registry, routingThreshold: 0.7 });
      const result = await router.decide(intent("create something", "je veux créer quelque chose"), context);

      assertEqual(result.type, "clarify");
      if (result.type === "clarify") {
        assertEqual(result.candidates.length >= 2, true);
      }
    },
  },
  {
    name: "rejects when no capability matches at all",
    run: async () => {
      const registry = fakeRegistry([{ id: "create_invoice" }]);
      const router = new HqRoutingDecisionRuntime({ registry });
      const result = await router.decide(intent("book a flight", "réserver un vol pour Paris"), context);

      assertEqual(result.type, "reject");
    },
  },
  {
    name: "rejects when HQ exposes no capabilities",
    run: async () => {
      const registry = fakeRegistry([]);
      const router = new HqRoutingDecisionRuntime({ registry });
      const result = await router.decide(intent("create task", "créer une tâche"), context);

      assertEqual(result.type, "reject");
    },
  },
  {
    name: "flags plan requiring confirmation for role-protected capability",
    run: async () => {
      const registry = fakeRegistry([{ id: "delete_database", description: "Delete database", requiredRoles: ["admin"] }]);
      const router = new HqRoutingDecisionRuntime({ registry });
      const result = await router.decide(intent("delete database", "supprimer la base de données"), context);

      assertEqual(result.type, "plan");
      if (result.type === "plan") {
        assertEqual(result.plan.requiresConfirmation, true);
      }
    },
  },
  {
    name: "custom resolver can override local scoring",
    run: async () => {
      const registry = fakeRegistry([
        { id: "create_task", description: "Create a task" },
        { id: "create_project", description: "Create a project" },
      ]);
      const router = new HqRoutingDecisionRuntime({
        registry,
        resolve: async (_intent, actions) => actions.find((a) => a.id === "create_project"),
      });
      const result = await router.decide(intent("start project", "démarrer un projet"), context);

      assertEqual(result.type, "plan");
      if (result.type === "plan") {
        assertEqual(result.plan.steps[0]?.capabilityId, "create_project");
      }
    },
  },
];

function assertEqual<T>(actual: T, expected: T): void {
  if (actual !== expected) {
    throw new Error(`Expected ${JSON.stringify(expected)} but got ${JSON.stringify(actual)}`);
  }
}

async function run(): Promise<void> {
  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      await test.run();
      passed++;
      console.log(`\u2713 ${test.name}`);
    } catch (error) {
      failed++;
      console.error(`\u2717 ${test.name}`);
      console.error(error instanceof Error ? error.message : error);
    }
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) {
    process.exit(1);
  }
}

run();
