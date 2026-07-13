import { HqActionRegistry, HqConnector, type FetchLike, type HttpResponse } from "../packages/hq-connector/src/index.js";
import { HqRoutingDecisionRuntime } from "../packages/decision-runtime/src/hq-router.js";
import type { ExecutionContext, Intention } from "../packages/core/src/contracts/index.js";

const config = {
  baseUrl: "https://hq.test",
  apiKey: "test-key",
  timeoutMs: 5000,
};

function jsonResponse(status: number, body: unknown): HttpResponse {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
    json: async () => body,
  };
}

function buildMockConnector(
  capsResponse: HttpResponse,
  execResponse: HttpResponse,
): {
  connector: HqConnector;
  calls: Array<{ url: string; method: "GET" | "POST"; headers: Record<string, string>; body?: string }>;
} {
  const calls: Array<{ url: string; method: "GET" | "POST"; headers: Record<string, string>; body?: string }> = [];
  const fetch: FetchLike = async (url, init) => {
    calls.push({ url, method: init.method, headers: init.headers, ...(init.body ? { body: init.body } : {}) });
    if (url.endsWith("/api/oip/capabilities")) {
      return capsResponse;
    }
    return execResponse;
  };
  return { connector: new HqConnector(config, fetch), calls };
}

function makeIntention(goal: string, rawText: string, entities: Array<{ name: string; value: unknown }> = []): Intention {
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

const executionContext: ExecutionContext = {
  requestId: "req-42",
  identity: {
    userId: "user-1",
    organizationId: "org-1",
    workspaceId: "ws-1",
    roles: ["sales"],
    scopes: [],
    permissions: [],
  },
  workspace: { id: "ws-1", name: "Test", plugins: [], locale: "fr", settings: {} },
  channel: "web",
  locale: "fr",
} as unknown as ExecutionContext;

function actorId(): string {
  return executionContext.identity.userId as string;
}

const tests: readonly { readonly name: string; readonly run: () => Promise<void> }[] = [
  {
    name: "END-TO-END: user intention → router plan → registry execution → HQ call",
    run: async () => {
      const { connector, calls } = buildMockConnector(
        jsonResponse(200, {
          capabilities: [
            { id: "create_task", description: "Create a task", inputSchema: { properties: { title: {}, assignee: {} } } },
          ],
        }),
        jsonResponse(200, { id: "task-123", title: "Tâche créée côté HQ" }),
      );

      const registry = new HqActionRegistry({ connector });
      const router = new HqRoutingDecisionRuntime({ registry, routingThreshold: 0.4 });

      const intention = makeIntention("create task", "créer une tâche pour Patrick", [
        { name: "title", value: "Relancer Patrick" },
        { name: "assignee", value: "Patrick" },
      ]);

      const decision = await router.decide(intention, executionContext);
      assertEqual(decision.type, "plan");

      if (decision.type !== "plan") {
        throw new Error("Expected a plan");
      }

      const step = decision.plan.steps[0];
      assertEqual(step?.capabilityId, "create_task");
      assertEqual(step?.arguments.title, "Relancer Patrick");
      assertEqual(step?.arguments.assignee, "Patrick");

      const capabilityId = step!.capabilityId!;
      const result = await registry.execute(capabilityId, step!.arguments, actorId());

      assertEqual(result.status, "completed");
      if (result.status === "completed") {
        assertEqual(result.data.id, "task-123");
      }

      assertEqual(calls.length, 2);
      assertEqual(calls[0]?.url, "https://hq.test/api/oip/capabilities");
      assertEqual(calls[1]?.url, "https://hq.test/api/oip/capabilities/create_task");
      assertEqual(calls[1]?.method, "POST");
      assertEqual(calls[1]?.headers["x-oip-api-key"], "test-key");
      assertEqual(calls[1]?.headers["x-oip-actor-id"], "user-1");
      const body = JSON.parse(calls[1]?.body ?? "{}");
      assertEqual(body.title, "Relancer Patrick");
      assertEqual(body.assignee, "Patrick");
    },
  },
  {
    name: "END-TO-END: ambiguous intention triggers clarification, no execution",
    run: async () => {
      const { connector } = buildMockConnector(
        jsonResponse(200, {
          capabilities: [
            { id: "create_task", description: "Create a task" },
            { id: "create_project", description: "Create a project" },
          ],
        }),
        jsonResponse(200, {}),
      );

      const registry = new HqActionRegistry({ connector });
      const router = new HqRoutingDecisionRuntime({ registry, routingThreshold: 0.7 });

      const intention = makeIntention("create something", "je veux créer quelque chose");
      const decision = await router.decide(intention, executionContext);

      assertEqual(decision.type, "clarify");
      if (decision.type === "clarify") {
        assertEqual(decision.candidates.length, 2);
      }
    },
  },
  {
    name: "END-TO-END: HQ 403 during execution is surfaced, OIP does not override",
    run: async () => {
      const { connector } = buildMockConnector(
        jsonResponse(200, { capabilities: [{ id: "delete_database", description: "Delete database", requiredRoles: ["admin"] }] }),
        jsonResponse(403, { error: "Forbidden: admin role required" }),
      );

      const registry = new HqActionRegistry({ connector });
      const router = new HqRoutingDecisionRuntime({ registry, routingThreshold: 0.4 });

      const intention = makeIntention("delete database", "supprimer la base de données");
      const decision = await router.decide(intention, executionContext);
      assertEqual(decision.type, "plan");

      if (decision.type !== "plan") throw new Error("Expected plan");
      const step = decision.plan.steps[0];
      assertEqual(decision.plan.requiresConfirmation, true);

      const capabilityId = step!.capabilityId!;
      const result = await registry.execute(capabilityId, step!.arguments, actorId());
      assertEqual(result.status, "forbidden");
      if (result.status === "forbidden") {
        assertEqual(result.message, "Forbidden: admin role required");
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
