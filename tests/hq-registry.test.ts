import {
  HqActionRegistry,
  HqConnector,
  HqConnectorError,
  type FetchLike,
  type HttpResponse,
} from "../packages/hq-connector/src/index.js";
import type { HqConnectorConfig } from "../packages/config/src/index.js";

const config: HqConnectorConfig = {
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

function buildConnector(
  responseForCapabilities: HttpResponse,
  responseForExecution?: HttpResponse,
): {
  connector: HqConnector;
  fetch: FetchLike;
  calls: Array<{ url: string; method: "GET" | "POST"; headers: Record<string, string>; body?: string }>;
} {
  const calls: Array<{ url: string; method: "GET" | "POST"; headers: Record<string, string>; body?: string }> = [];
  const fetch: FetchLike = async (url, init) => {
    calls.push({ url, method: init.method, headers: init.headers, ...(init.body ? { body: init.body } : {}) });
    if (url.endsWith("/api/oip/capabilities")) {
      return responseForCapabilities;
    }
    return responseForExecution ?? responseForCapabilities;
  };
  return { connector: new HqConnector(config, fetch), fetch, calls };
}

const tests: readonly { readonly name: string; readonly run: () => Promise<void> }[] = [
  {
    name: "HqActionRegistry discovers capabilities as actions",
    run: async () => {
      const { connector } = buildConnector(
        jsonResponse(200, {
          capabilities: [
            { id: "create_task", description: "Create a task", requiredRoles: ["admin"] },
            { id: "create_lead", inputSchema: { type: "object" } },
          ],
        }),
      );
      const registry = new HqActionRegistry({ connector });
      const result = await registry.discover();

      assertEqual(result.count, 2);
      assertEqual(result.actions[0]?.id, "create_task");
      assertEqual(result.actions[0]?.requiredRoles?.[0], "admin");
      assertEqual(registry.has("create_lead"), true);
      assertEqual(registry.get("create_task")?.description, "Create a task");
      assertEqual(registry.list().length, 2);
    },
  },
  {
    name: "execute uses connector with actor-id and returns completed",
    run: async () => {
      const { connector, calls } = buildConnector(
        jsonResponse(200, {
          capabilities: [{ id: "create_task", description: "Create a task", requiredRoles: ["admin"] },
                         { id: "create_lead", inputSchema: { type: "object" } }],
        }),
        jsonResponse(200, { id: "task-1", title: "Tâche créée côté HQ" }),
      );
      const registry = new HqActionRegistry({ connector });
      await registry.discover();
      const result = await registry.execute("create_task", { title: "Acheter du ciment" }, "user-42");

      assertEqual(result.status, "completed");
      if (result.status === "completed") {
        assertEqual(result.data.id, "task-1");
      }
      assertEqual(calls[1]?.method, "POST");
      assertEqual(calls[1]?.headers["x-oip-actor-id"], "user-42");
      assertEqual(calls[1]?.headers["x-oip-api-key"], "test-key");
    },
  },
  {
    name: "execute returns unknown_capability when not discovered",
    run: async () => {
      const { connector } = buildConnector(jsonResponse(200, { capabilities: [] }));
      const registry = new HqActionRegistry({ connector });
      const result = await registry.execute("missing_capability", {}, "user-1");

      assertEqual(result.status, "unknown_capability");
    },
  },
  {
    name: "discoverAndExecute refreshes then executes",
    run: async () => {
      const { connector, calls } = buildConnector(
        jsonResponse(200, { capabilities: [{ id: "create_project" }] }),
      );
      const registry = new HqActionRegistry({ connector });
      const result = await registry.discoverAndExecute("create_project", { name: "Projet X" }, "user-7") as { status: string };

      assertEqual(result.status, "completed");
      assertEqual(calls[0]?.url, "https://hq.test/api/oip/capabilities");
      assertEqual(calls[1]?.url, "https://hq.test/api/oip/capabilities/create_project");
    },
  },
  {
    name: "execute relays HQ 403 as forbidden without business logic",
    run: async () => {
      const { connector } = buildConnector(
        jsonResponse(200, { capabilities: [{ id: "create_task" }] }),
        jsonResponse(403, { error: "Forbidden by hasRole" }),
      );
      const registry = new HqActionRegistry({ connector });
      await registry.discover();
      const result = await registry.execute("create_task", {}, "user-1");

      assertEqual(result.status, "forbidden");
      if (result.status === "forbidden") {
        assertEqual(result.message, "Forbidden by hasRole");
      }
    },
  },
  {
    name: "execute surfaces 422 validation errors from HQ",
    run: async () => {
      const { connector } = buildConnector(
        jsonResponse(200, { capabilities: [{ id: "create_task" }] }),
        jsonResponse(422, { error: "title is required" }),
      );
      const registry = new HqActionRegistry({ connector });
      await registry.discover();
      const result = await registry.execute("create_task", {}, "user-1");

      assertEqual(result.status, "invalid");
      if (result.status === "invalid") {
        assertEqual(result.httpStatus, 422);
        assertEqual(result.message, "title is required");
      }
    },
  },
  {
    name: "discover throws and records error on HQ 401",
    run: async () => {
      const { connector } = buildConnector(jsonResponse(401, { error: "bad key" }));
      const registry = new HqActionRegistry({ connector });
      let threw = false;
      try {
        await registry.discover();
      } catch (e) {
        threw = e instanceof HqConnectorError && e.code === "unauthenticated";
      }
      assertEqual(threw, true);
      assertEqual(registry.getLastError() instanceof HqConnectorError, true);
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
