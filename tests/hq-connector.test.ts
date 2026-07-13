import {
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

/** Records the last request so we can assert headers/URL. */
function recordingFetch(response: HttpResponse): {
  fetch: FetchLike;
  calls: Array<{ url: string; method: string; headers: Record<string, string>; body?: string }>;
} {
  const calls: Array<{ url: string; method: string; headers: Record<string, string>; body?: string }> = [];
  const fetch: FetchLike = async (url, init) => {
    calls.push({ url, method: init.method, headers: init.headers, ...(init.body ? { body: init.body } : {}) });
    return response;
  };
  return { fetch, calls };
}

const tests: readonly { readonly name: string; readonly run: () => Promise<void> }[] = [
  {
    name: "listCapabilities sends x-oip-api-key and parses capability registry",
    run: async () => {
      const { fetch, calls } = recordingFetch(
        jsonResponse(200, {
          capabilities: [
            { id: "create_task", description: "Create a task", requiredRoles: ["admin"] },
            { id: "create_lead", inputSchema: { type: "object" } },
          ],
        }),
      );
      const connector = new HqConnector(config, fetch);
      const caps = await connector.listCapabilities();

      assertEqual(caps.length, 2);
      assertEqual(caps[0]?.id, "create_task");
      assertEqual(calls[0]?.url, "https://hq.test/api/oip/capabilities");
      assertEqual(calls[0]?.headers["x-oip-api-key"], "test-key");
    },
  },
  {
    name: "listCapabilities throws unauthenticated on 401",
    run: async () => {
      const { fetch } = recordingFetch(jsonResponse(401, { error: "Clé OIP manquante ou invalide" }));
      const connector = new HqConnector(config, fetch);
      await assertThrows(
        () => connector.listCapabilities(),
        (e) => e instanceof HqConnectorError && e.code === "unauthenticated",
      );
    },
  },
  {
    name: "executeCapability sends actor-id header and returns completed on 200",
    run: async () => {
      const { fetch, calls } = recordingFetch(jsonResponse(200, { id: "task-1", title: "hidden" }));
      const connector = new HqConnector(config, fetch);
      const result = await connector.executeCapability("create_task", { title: "x" }, "user-42");

      assertEqual(result.status, "completed");
      assertEqual(calls[0]?.url, "https://hq.test/api/oip/capabilities/create_task");
      assertEqual(calls[0]?.method, "POST");
      assertEqual(calls[0]?.headers["x-oip-actor-id"], "user-42");
      assertEqual(calls[0]?.headers["x-oip-api-key"], "test-key");
    },
  },
  {
    name: "executeCapability relays HQ 403 as forbidden (no business rule in OIP)",
    run: async () => {
      const { fetch } = recordingFetch(jsonResponse(403, { error: "Forbidden by hasRole" }));
      const connector = new HqConnector(config, fetch);
      const result = await connector.executeCapability("create_task", {}, "user-1");

      assertEqual(result.status, "forbidden");
      if (result.status === "forbidden") {
        assertEqual(result.httpStatus, 403);
        assertEqual(result.message, "Forbidden by hasRole");
      }
    },
  },
  {
    name: "executeCapability surfaces 422 validation error with details",
    run: async () => {
      const { fetch } = recordingFetch(jsonResponse(422, { error: "title is required" }));
      const connector = new HqConnector(config, fetch);
      const result = await connector.executeCapability("create_task", {}, "user-1");

      assertEqual(result.status, "invalid");
      if (result.status === "invalid") {
        assertEqual(result.httpStatus, 422);
        assertEqual(result.message, "title is required");
      }
    },
  },
  {
    name: "executeCapability requires a non-empty actorId",
    run: async () => {
      const { fetch } = recordingFetch(jsonResponse(200, {}));
      const connector = new HqConnector(config, fetch);
      await assertThrows(
        () => connector.executeCapability("create_task", {}, ""),
        (e) => e instanceof HqConnectorError && e.code === "malformed_response",
      );
    },
  },
  {
    name: "getExecutionLogs builds query string and returns masked rows only",
    run: async () => {
      const { fetch, calls } = recordingFetch(
        jsonResponse(200, {
          logs: [
            { actor_role: "admin", capability: "create_task", mode: "real", ok: true, duration_ms: 42, actor_id: "LEAK" },
          ],
        }),
      );
      const connector = new HqConnector(config, fetch);
      const logs = await connector.getExecutionLogs({ capability: "create_task", mode: "real", ok: true, limit: 10 });

      assertEqual(logs.length, 1);
      assertEqual(logs[0]?.actor_role, "admin");
      assertEqual(logs[0]?.mode, "real");
      assertEqual(logs[0]?.duration_ms, 42);
      // Masked fields must never appear on our typed row.
      assertEqual((logs[0] as unknown as Record<string, unknown>)["actor_id"], undefined);
      const url = calls[0]?.url ?? "";
      assertEqual(url.includes("capability=create_task"), true);
      assertEqual(url.includes("mode=real"), true);
      assertEqual(url.includes("ok=true"), true);
      assertEqual(url.includes("limit=10"), true);
    },
  },
  {
    name: "request maps AbortError to a timeout HqConnectorError",
    run: async () => {
      const timeoutFetch: FetchLike = async () => {
        const err = new Error("aborted");
        err.name = "AbortError";
        throw err;
      };
      const connector = new HqConnector(config, timeoutFetch);
      await assertThrows(
        () => connector.listCapabilities(),
        (e) => e instanceof HqConnectorError && e.code === "timeout",
      );
    },
  },
];

function assertEqual<T>(actual: T, expected: T): void {
  if (actual !== expected) {
    throw new Error(`Expected ${JSON.stringify(expected)} but got ${JSON.stringify(actual)}`);
  }
}

async function assertThrows(fn: () => Promise<unknown>, predicate: (e: unknown) => boolean): Promise<void> {
  try {
    await fn();
  } catch (error) {
    if (predicate(error)) return;
    throw new Error(`Threw but predicate failed: ${error instanceof Error ? error.message : String(error)}`);
  }
  throw new Error("Expected function to throw, but it did not.");
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
