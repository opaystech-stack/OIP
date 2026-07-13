import { SemanticDispatcher } from "../packages/semantic-dispatcher/src/index.js";
import { ManifestClient } from "../packages/hq-connector/src/index.js";
import type { HqExecutionResult, FetchLike, HttpResponse } from "../packages/hq-connector/src/index.js";
import type { SemanticManifest } from "../packages/hq-connector/src/manifest.js";
import type { IdentityContext } from "../packages/core/src/contracts/identity.js";
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

function identity(roles: readonly string[] = ["sales"]): IdentityContext {
  return {
    userId: "user-1",
    organizationId: "org-1",
    roles,
    locale: "fr",
  };
}

const ledgerManifest: SemanticManifest = {
  product: "Ledger-Test",
  version: "0.1.0",
  entities: {
    Transaction: {
      description: "A ledger transaction",
      fields: {
        id: { type: "uuid", readonly: true },
        amount: { type: "currency", required: true },
        label: { type: "string", required: true },
        status: { type: "enum", values: ["draft", "posted", "reconciled"] },
      },
      operations: {
        create: { roles: ["accountant", "ceo"] },
        read: { roles: ["accountant", "ceo", "sales"] },
        reconcile: { roles: ["accountant"] },
      },
    },
  },
};

const tests: readonly { readonly name: string; readonly run: () => Promise<void> }[] = [
  {
    name: "executes create Transaction by loading manifest on demand",
    run: async () => {
      const { client, calls: manifestCalls } = buildManifestClient(ledgerManifest);
      const { connector, calls: execCalls } = buildConnector({
        status: "completed",
        httpStatus: 200,
        data: { id: "txn-42", amount: 1500, label: "Vente SaaS" },
      });
      const dispatcher = new SemanticDispatcher({
        manifestClient: client,
        connector,
        product: "Ledger-Test",
      });

      const result = await dispatcher.execute(
        "Transaction",
        "create",
        { amount: 1500, label: "Vente SaaS" },
        identity(["accountant"]),
      );

      assertEqual(result.status, "completed");
      if (result.status === "completed") {
        assertEqual(result.data?.id, "txn-42");
      }
      assertEqual(manifestCalls.length, 1);
      assertEqual(manifestCalls[0]?.url, "https://hq.test/api/oip/manifest?product=Ledger-Test");
      assertEqual(execCalls.length, 1);
      assertEqual(execCalls[0]?.id, "semantic/Transaction/create");
      assertEqual(execCalls[0]?.args.amount, 1500);
    },
  },
  {
    name: "forbids operation when role is missing",
    run: async () => {
      const { client } = buildManifestClient(ledgerManifest);
      const { connector, calls: execCalls } = buildConnector({
        status: "completed",
        httpStatus: 200,
        data: {},
      });
      const dispatcher = new SemanticDispatcher({ manifestClient: client, connector, product: "Ledger-Test" });

      const result = await dispatcher.execute(
        "Transaction",
        "reconcile",
        { id: "txn-1" },
        identity(["ceo"]),
      );

      assertEqual(result.status, "forbidden");
      assertEqual(execCalls.length, 0);
    },
  },
  {
    name: "validates required fields",
    run: async () => {
      const { client } = buildManifestClient(ledgerManifest);
      const { connector, calls: execCalls } = buildConnector({
        status: "completed",
        httpStatus: 200,
        data: {},
      });
      const dispatcher = new SemanticDispatcher({ manifestClient: client, connector, product: "Ledger-Test" });

      const result = await dispatcher.execute(
        "Transaction",
        "create",
        { amount: 1500 },
        identity(["accountant"]),
      );

      assertEqual(result.status, "invalid");
      if (result.status === "invalid") {
        assertEqual(Array.isArray(result.details?.missing), true);
        assertEqual((result.details?.missing as unknown[])[0], "label");
      }
      assertEqual(execCalls.length, 0);
    },
  },
  {
    name: "rejects undeclared entity or operation",
    run: async () => {
      const { client } = buildManifestClient(ledgerManifest);
      const { connector, calls: execCalls } = buildConnector({ status: "completed", httpStatus: 200, data: {} });
      const dispatcher = new SemanticDispatcher({ manifestClient: client, connector, product: "Ledger-Test" });

      const entityResult = await dispatcher.execute("Account", "create", {}, identity(["accountant"]));
      assertEqual(entityResult.status, "invalid");

      const opResult = await dispatcher.execute("Transaction", "delete", { id: "txn-1" }, identity(["accountant"]));
      assertEqual(opResult.status, "invalid");
      assertEqual(execCalls.length, 0);
    },
  },
  {
    name: "short cache TTL avoids redundant manifest calls",
    run: async () => {
      const { client, calls: manifestCalls } = buildManifestClient(ledgerManifest);
      const { connector } = buildConnector({ status: "completed", httpStatus: 200, data: {} });
      const dispatcher = new SemanticDispatcher({
        manifestClient: client,
        connector,
        product: "Ledger-Test",
        manifestCacheMs: 1000,
      });

      await dispatcher.execute("Transaction", "read", { id: "txn-1" }, identity(["sales"]));
      await dispatcher.execute("Transaction", "read", { id: "txn-2" }, identity(["sales"]));

      assertEqual(manifestCalls.length, 1);
    },
  },
  {
    name: "uses no hard-coded tools: works on a manifest the dispatcher has never seen",
    run: async () => {
      const starshipManifest: SemanticManifest = {
        product: "Starship-Test",
        version: "0.1.0",
        entities: {
          Mission: {
            description: "Space mission planning",
            fields: {
              id: { type: "uuid", readonly: true },
              target: { type: "string", required: true },
              crew: { type: "integer" },
            },
            operations: {
              plan: { roles: ["commander"] },
            },
          },
        },
      };
      const { client, calls: manifestCalls } = buildManifestClient(starshipManifest);
      const { connector, calls: execCalls } = buildConnector({
        status: "completed",
        httpStatus: 200,
        data: { id: "m-1", target: "Mars", crew: 4 },
      });
      const dispatcher = new SemanticDispatcher({ manifestClient: client, connector, product: "Starship-Test" });

      const result = await dispatcher.execute(
        "Mission",
        "plan",
        { target: "Mars", crew: 4 },
        identity(["commander"]),
      );

      assertEqual(result.status, "completed");
      assertEqual(manifestCalls[0]?.url, "https://hq.test/api/oip/manifest?product=Starship-Test");
      assertEqual(execCalls[0]?.id, "semantic/Mission/plan");
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
