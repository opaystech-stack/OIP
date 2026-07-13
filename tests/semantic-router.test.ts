import { SemanticDispatcher, SemanticIntentRouter, ManifestClient } from "../packages/semantic-dispatcher/src/index.js";
import type { HttpResponse, FetchLike, HqExecutionResult } from "../packages/hq-connector/src/index.js";
import type { SemanticManifest } from "../packages/hq-connector/src/manifest.js";
import type { Intention } from "../packages/core/src/contracts/intention.js";
import type { ExecutionContext } from "../packages/core/src/contracts/context.js";
import type { JsonObject } from "../packages/core/src/index.js";

const config = {
  baseUrl: "https://hq.test",
  apiKey: "test-key",
  timeoutMs: 5_000,
};

function jsonResponse(status: number, body: unknown): HttpResponse {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
    json: async () => body,
  };
}

function buildManifestClient(manifest: SemanticManifest): {
  client: ManifestClient;
  calls: Array<{ url: string; method: "GET" | "POST"; headers: Record<string, string> }>;
} {
  const calls: Array<{ url: string; method: "GET" | "POST"; headers: Record<string, string> }> = [];
  const fetch: FetchLike = async (url, init) => {
    calls.push({ url, method: init.method, headers: init.headers });
    return jsonResponse(200, manifest);
  };
  return { client: new ManifestClient(config, fetch), calls };
}

function buildConnector(result: HqExecutionResult): {
  connector: { executeCapability: (id: string, actorId: string, args: JsonObject) => Promise<HqExecutionResult> };
  calls: Array<{ id: string; actorId: string; args: JsonObject }>;
} {
  const calls: Array<{ id: string; actorId: string; args: JsonObject }> = [];
  return {
    connector: {
      executeCapability: async (id: string, actorId: string, args: JsonObject) => {
        calls.push({ id, actorId, args });
        return result;
      },
    },
    calls,
  };
}

function makeIntention(goal: string, entities: Array<{ name: string; value: unknown }>, confidence = 0.9): Intention {
  return {
    goal,
    rawText: goal,
    type: goal,
    confidence,
    entities: entities.map((e) => ({
      name: e.name,
      value: e.value as import("../packages/core/src/index.js").JsonValue,
    })),
  };
}

const executionContext: ExecutionContext = {
  requestId: "req-42",
  identity: {
    userId: "user-1",
    organizationId: "org-1",
    workspaceId: "ws-1",
    roles: ["accountant"],
    scopes: [],
    permissions: [],
  },
  workspace: { id: "ws-1", name: "Test", plugins: [], locale: "fr", settings: {} },
  channel: "web",
  locale: "fr",
} as unknown as ExecutionContext;

const manifest: SemanticManifest = {
  product: "Ledger-Test",
  version: "1.0.0",
  entities: {
    Transaction: {
      description: "A ledger transaction",
      fields: {
        id: { type: "uuid", readonly: true },
        amount: { type: "currency", required: true },
        label: { type: "string", required: true },
      },
      operations: {
        create: { roles: ["accountant", "ceo"] },
      },
    },
  },
};

const tests: readonly { readonly name: string; readonly run: () => Promise<void> }[] = [
  {
    name: "SemanticIntentRouter resolves [Entity, Operation, Arguments] and executes via dispatcher",
    run: async () => {
      const { client: manifestClient, calls: manifestCalls } = buildManifestClient(manifest);
      const { connector, calls: execCalls } = buildConnector({
        status: "completed",
        httpStatus: 200,
        data: { id: "txn-42", amount: 1500, label: "Vente SaaS" },
      });

      const dispatcher = new SemanticDispatcher({
        manifestClient,
        connector,
        product: "Ledger-Test",
      });
      const router = new SemanticIntentRouter({ dispatcher });

      const intention = makeIntention("create transaction", [
        { name: "entity", value: "Transaction" },
        { name: "operation", value: "create" },
        { name: "amount", value: 1500 },
        { name: "label", value: "Vente SaaS" },
      ]);

      const result = await router.execute(intention, executionContext);

      assertEqual(result.status, "completed");
      if (result.status === "completed") {
        assertEqual(result.data?.id, "txn-42");
      }
      assertEqual(manifestCalls.length, 1);
      assertEqual(manifestCalls[0]?.url, "https://hq.test/api/oip/manifest?product=Ledger-Test");
      assertEqual(execCalls.length, 1);
      assertEqual(execCalls[0]?.id, "semantic/Transaction/create");
      assertEqual(execCalls[0]?.args.amount, 1500);
      assertEqual(execCalls[0]?.args.label, "Vente SaaS");
    },
  },
  {
    name: "Custom resolver can derive entity/operation from free-form goal",
    run: async () => {
      const { client: manifestClient } = buildManifestClient(manifest);
      const { connector, calls: execCalls } = buildConnector({ status: "completed", httpStatus: 200, data: {} });

      const dispatcher = new SemanticDispatcher({ manifestClient, connector, product: "Ledger-Test" });
      const router = new SemanticIntentRouter({
        dispatcher,
        resolve: (intent) => {
          if (intent.goal.includes("transaction")) {
            return { entity: "Transaction", operation: "create" };
          }
          return undefined;
        },
      });

      const intention = makeIntention("transaction", [
        { name: "amount", value: 500 },
        { name: "label", value: "Frais" },
      ]);

      const result = await router.execute(intention, executionContext);

      assertEqual(result.status, "completed");
      assertEqual(execCalls[0]?.id, "semantic/Transaction/create");
    },
  },
  {
    name: "Low-confidence intention is rejected before execution",
    run: async () => {
      const { client: manifestClient } = buildManifestClient(manifest);
      const { connector, calls: execCalls } = buildConnector({ status: "completed", httpStatus: 200, data: {} });

      const dispatcher = new SemanticDispatcher({ manifestClient, connector, product: "Ledger-Test" });
      const router = new SemanticIntentRouter({ dispatcher, confidenceThreshold: 0.5 });

      const intention = makeIntention("create transaction", [
        { name: "entity", value: "Transaction" },
        { name: "operation", value: "create" },
      ], 0.2);

      const result = await router.execute(intention, executionContext);

      assertEqual(result.status, "invalid");
      assertEqual(execCalls.length, 0);
    },
  },
  {
    name: "RBAC is enforced before calling the product",
    run: async () => {
      const { client: manifestClient } = buildManifestClient(manifest);
      const { connector, calls: execCalls } = buildConnector({ status: "completed", httpStatus: 200, data: {} });

      const dispatcher = new SemanticDispatcher({ manifestClient, connector, product: "Ledger-Test" });
      const router = new SemanticIntentRouter({ dispatcher });

      const lowRoleContext = { ...executionContext, identity: { ...executionContext.identity, roles: ["sales"] } };
      const intention = makeIntention("create transaction", [
        { name: "entity", value: "Transaction" },
        { name: "operation", value: "create" },
        { name: "amount", value: 100 },
        { name: "label", value: "Test" },
      ]);

      const result = await router.execute(intention, lowRoleContext);

      assertEqual(result.status, "forbidden");
      assertEqual(execCalls.length, 0);
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
  if (failed > 0) process.exit(1);
}

run();
