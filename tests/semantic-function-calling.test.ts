import { ManifestClient } from "../packages/hq-connector/src/index.js";
import type { HqExecutionResult, FetchLike, HttpResponse } from "../packages/hq-connector/src/index.js";
import type { SemanticManifest } from "../packages/hq-connector/src/manifest.js";
import type { IdentityContext } from "../packages/core/src/contracts/identity.js";
import type { JsonObject } from "../packages/core/src/index.js";
import {
  SemanticDispatcher,
  MultiAppCatalogue,
  manifestToFunctionTools,
  parseFunctionName,
  toFunctionName,
} from "../packages/semantic-dispatcher/src/index.js";

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

function manifestClientFor(manifest: SemanticManifest): ManifestClient {
  const fetch: FetchLike = async () => jsonResponse(200, manifest);
  return new ManifestClient(config, fetch);
}

function connectorRecording(result: HqExecutionResult): {
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
  return { userId: "user-1", organizationId: "org-1", roles, locale: "fr" };
}

// A retail product manifest whose "search" operation makes lat/lng/radius
// mandatory — enforced purely by the manifest, no geo logic in OIP.
const bizManifest: SemanticManifest = {
  product: "opays-biz",
  version: "1.0.0",
  entities: {
    Merchant: {
      description: "A physical merchant",
      fields: {
        id: { type: "uuid", readonly: true },
        name: { type: "string", required: true },
        lat: { type: "number", required: true, min: -90, max: 90, description: "Latitude" },
        lng: { type: "number", required: true, min: -180, max: 180, description: "Longitude" },
        radius: { type: "number", required: true, min: 0, description: "Search radius (m)" },
      },
      operations: {
        search: { roles: ["sales"] },
      },
    },
  },
};

const foxManifest: SemanticManifest = {
  product: "opays-fox",
  version: "1.0.0",
  entities: {
    Quote: {
      description: "A forex quote",
      fields: {
        id: { type: "uuid", readonly: true },
        pair: { type: "enum", required: true, values: ["EURUSD", "USDXOF"] },
        amount: { type: "currency", required: true },
      },
      operations: {
        request: { roles: ["sales"] },
      },
    },
  },
};

const tests: readonly { readonly name: string; readonly run: () => Promise<void> }[] = [
  {
    name: "function name round-trips through toFunctionName/parseFunctionName",
    run: async () => {
      const name = toFunctionName("Merchant", "search");
      assertEqual(name, "Merchant__search");
      const parsed = parseFunctionName(name);
      assertEqual(parsed?.entity, "Merchant");
      assertEqual(parsed?.operation, "search");
      assertEqual(parseFunctionName("bogus"), undefined);
    },
  },
  {
    name: "manifestToFunctionTools emits JSON-Schema with required geo fields",
    run: async () => {
      const tools = manifestToFunctionTools(bizManifest);
      assertEqual(tools.length, 1);
      const tool = tools[0]!;
      assertEqual(tool.type, "function");
      assertEqual(tool.function.name, "Merchant__search");
      const params = tool.function.parameters;
      assertEqual(params.type, "object");
      // readonly id must be excluded
      assertEqual(params.properties?.id, undefined);
      // geo fields present and required
      assertEqual(params.properties?.lat?.type, "number");
      assertEqual(params.properties?.lat?.minimum, -90);
      const required = params.required ?? [];
      assertEqual(required.includes("lat"), true);
      assertEqual(required.includes("lng"), true);
      assertEqual(required.includes("radius"), true);
    },
  },
  {
    name: "dispatcher rejects search missing geo params (manifest-enforced)",
    run: async () => {
      const { connector, calls } = connectorRecording({ status: "completed", httpStatus: 200, data: {} });
      const dispatcher = new SemanticDispatcher({
        manifestClient: manifestClientFor(bizManifest),
        connector,
        product: "opays-biz",
      });
      const result = await dispatcher.execute("Merchant", "search", { name: "Chez Awa" }, identity(["sales"]));
      assertEqual(result.status, "invalid");
      if (result.status === "invalid") {
        const missing = (result.details?.missing as unknown[]) ?? [];
        assertEqual(missing.includes("lat"), true);
        assertEqual(missing.includes("lng"), true);
        assertEqual(missing.includes("radius"), true);
      }
      assertEqual(calls.length, 0);
    },
  },
  {
    name: "dispatcher rejects out-of-bounds latitude (min/max)",
    run: async () => {
      const { connector } = connectorRecording({ status: "completed", httpStatus: 200, data: {} });
      const dispatcher = new SemanticDispatcher({
        manifestClient: manifestClientFor(bizManifest),
        connector,
        product: "opays-biz",
      });
      const result = await dispatcher.execute(
        "Merchant",
        "search",
        { name: "X", lat: 200, lng: 0, radius: 500 },
        identity(["sales"]),
      );
      assertEqual(result.status, "invalid");
    },
  },
  {
    name: "dispatcher accepts a valid geo search",
    run: async () => {
      const { connector, calls } = connectorRecording({
        status: "completed",
        httpStatus: 200,
        data: { results: [] },
      });
      const dispatcher = new SemanticDispatcher({
        manifestClient: manifestClientFor(bizManifest),
        connector,
        product: "opays-biz",
      });
      const result = await dispatcher.execute(
        "Merchant",
        "search",
        { name: "X", lat: 5.34, lng: -4.02, radius: 1000 },
        identity(["sales"]),
      );
      assertEqual(result.status, "completed");
      assertEqual(calls[0]?.id, "semantic/Merchant/search");
    },
  },
  {
    name: "MultiAppCatalogue aggregates tools from every product, namespaced",
    run: async () => {
      const biz = new SemanticDispatcher({ manifestClient: manifestClientFor(bizManifest), connector: connectorRecording({ status: "completed", httpStatus: 200, data: {} }).connector, product: "opays-biz" });
      const fox = new SemanticDispatcher({ manifestClient: manifestClientFor(foxManifest), connector: connectorRecording({ status: "completed", httpStatus: 200, data: {} }).connector, product: "opays-fox" });
      const catalogue = new MultiAppCatalogue([
        { id: "opays-biz", dispatcher: biz },
        { id: "opays-fox", dispatcher: fox },
      ]);

      const { tools, errors } = await catalogue.listTools();
      assertEqual(Object.keys(errors).length, 0);
      assertEqual(tools.length, 2);
      const names = tools.map((t) => t.function.name).sort();
      assertEqual(names[0], "opays-biz::Merchant__search");
      assertEqual(names[1], "opays-fox::Quote__request");
    },
  },
  {
    name: "MultiAppCatalogue routes a namespaced call to the owning product",
    run: async () => {
      const bizConn = connectorRecording({ status: "completed", httpStatus: 200, data: { ok: true } });
      const foxConn = connectorRecording({ status: "completed", httpStatus: 200, data: {} });
      const biz = new SemanticDispatcher({ manifestClient: manifestClientFor(bizManifest), connector: bizConn.connector, product: "opays-biz" });
      const fox = new SemanticDispatcher({ manifestClient: manifestClientFor(foxManifest), connector: foxConn.connector, product: "opays-fox" });
      const catalogue = new MultiAppCatalogue([
        { id: "opays-biz", dispatcher: biz },
        { id: "opays-fox", dispatcher: fox },
      ]);

      const result = await catalogue.dispatch(
        "opays-biz::Merchant__search",
        { name: "X", lat: 5.34, lng: -4.02, radius: 1000 },
        identity(["sales"]),
      );
      assertEqual(result.status, "completed");
      assertEqual(bizConn.calls.length, 1);
      assertEqual(foxConn.calls.length, 0);
      assertEqual(bizConn.calls[0]?.id, "semantic/Merchant/search");
    },
  },
  {
    name: "MultiAppCatalogue rejects unknown product / malformed name",
    run: async () => {
      const catalogue = new MultiAppCatalogue([]);
      const bad = await catalogue.dispatch("nope", {}, identity());
      assertEqual(bad.status, "invalid");
      const unknown = await catalogue.dispatch("ghost::Merchant__search", {}, identity());
      assertEqual(unknown.status, "invalid");
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
