import { OipPublicApi, buildRuntimeContextFromAuth } from "../packages/public-api/src/public-api.js";
import { OipPublicClient } from "../packages/public-api/src/sdk.js";
import { startPublicApiServer } from "../examples/public-api-demo/src/server.js";
import { MockLlmAdapter } from "../packages/llm-adapter/src/index.js";
import type { OipRuntime } from "../packages/runtime/src/index.js";
import type { JsonValue, LlmGenerateTextPayload } from "../packages/public-api/src/types.js";

const mockRuntime = {
  execute: async () => ({ status: "completed" as const, events: [] }),
  events: { publish: async () => {} },
  knowledge: { search: async () => [] },
  memory: { recent: async () => [] },
  context: { build: async () => ({}) },
} as unknown as OipRuntime;

const tests: readonly { readonly name: string; readonly run: () => Promise<void> }[] = [
  {
    name: "Public API facade returns text result for llm.generateText",
    run: async () => {
      const llm = new MockLlmAdapter(() => ({
        content: "Bonjour depuis OIP",
        model: "mock-model",
        usage: { promptTokens: 10, completionTokens: 5 },
      }));

      const api = new OipPublicApi({ runtime: mockRuntime, llm });
      const response = await api.invoke({
        requestId: "req-1",
        operation: "llm.generateText",
        payload: {
          messages: [{ role: "user", content: "Dis bonjour" }],
        } as unknown as Record<string, JsonValue>,
      });

      assertEqual(response.status, "completed");
      assertEqual((response.result as { text: string }).text, "Bonjour depuis OIP");
      assertEqual(response.metadata?.version, "v1");
    },
  },
  {
    name: "Public API facade rejects unknown operations",
    run: async () => {
      const llm = new MockLlmAdapter(() => ({ content: "" }));
      const api = new OipPublicApi({ runtime: mockRuntime, llm });
      const response = await api.invoke({
        requestId: "req-2",
        operation: "memory.store",
        payload: { entry: "test" },
      });

      assertEqual(response.status, "error");
      assertEqual(response.error?.code, "operation.not-supported");
    },
  },
  {
    name: "Public API SDK calls facade locally",
    run: async () => {
      const llm = new MockLlmAdapter(() => ({
        content: "Réponse locale",
        model: "mock-sdk",
      }));
      const api = new OipPublicApi({ runtime: mockRuntime, llm });
      const context = buildRuntimeContextFromAuth({
        userId: "user-1",
        organizationId: "org-1",
        roles: ["developer"],
      });

      const client = OipPublicClient.create({ runtimeContext: context, api });
      const result = await client.llmGenerateText({
        messages: [{ role: "user", content: "Test SDK local" }],
      });

      assertEqual(result.text, "Réponse locale");
    },
  },
  {
    name: "HTTP server exposes POST /v1/oip/invoke for llm.generateText",
    run: async () => {
      const llm = new MockLlmAdapter(() => ({
        content: "Réponse HTTP",
        model: "mock-http",
      }));
      const api = new OipPublicApi({ runtime: mockRuntime, llm });
      const server = startPublicApiServer({ port: 0, api });

      try {
        await waitForServer(server);
        const address = server.address();
        if (!address || typeof address === "string") {
          throw new Error("Test server did not expose a TCP address.");
        }

        const baseUrl = `http://127.0.0.1:${address.port}`;
        const response = await fetchJson(`${baseUrl}/v1/oip/invoke`, {
          method: "POST",
          body: JSON.stringify({
            requestId: "http-req-1",
            operation: "llm.generateText",
            payload: {
              messages: [{ role: "user", content: "Test HTTP" }],
            },
          }),
        });

        const body = response as { status: string; result: { text: string }; metadata: { version: string } };
        assertEqual(body.status, "completed");
        assertEqual(body.result.text, "Réponse HTTP");
        assertEqual(body.metadata.version, "v1");
      } finally {
        server.close();
      }
    },
  },
  {
    name: "HTTP server returns 400 for missing required fields",
    run: async () => {
      const llm = new MockLlmAdapter(() => ({ content: "" }));
      const api = new OipPublicApi({ runtime: mockRuntime, llm });
      const server = startPublicApiServer({ port: 0, api });

      try {
        await waitForServer(server);
        const address = server.address();
        if (!address || typeof address === "string") {
          throw new Error("Test server did not expose a TCP address.");
        }

        const baseUrl = `http://127.0.0.1:${address.port}`;
        const response = await fetch(`${baseUrl}/v1/oip/invoke`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ requestId: "bad-req" }),
        });

        assertEqual(response.status, 400);
        const body = (await response.json()) as { status: string; error: { code: string } };
        assertEqual(body.status, "error");
        assertEqual(body.error.code, "request.invalid");
      } finally {
        server.close();
      }
    },
  },
  {
    name: "Public API response shape matches ADR-009 contract",
    run: async () => {
      const llm = new MockLlmAdapter(() => ({
        content: "Shape valid",
        model: "mock-shape",
        usage: { promptTokens: 3, completionTokens: 2 },
      }));

      const api = new OipPublicApi({ runtime: mockRuntime, llm });
      const response = await api.invoke({
        requestId: "shape-req",
        operation: "llm.generateText",
        payload: {
          messages: [{ role: "user", content: "Vérifie" }],
        } as unknown as Record<string, JsonValue>,
      });

      assertEqual(response.requestId, "shape-req");
      assertEqual(response.operation, "llm.generateText");
      assertEqual(response.status, "completed");
      assertEqual(typeof (response.result as { text: string }).text, "string");
      assertEqual(typeof response.metadata.durationMs, "number");
      assertEqual(response.metadata.version, "v1");
    },
  },
];

function assertEqual(actual: unknown, expected: unknown): void {
  if (actual !== expected) {
    throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

async function fetchJson(url: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(url, init);
  return response.json();
}

async function waitForServer(server: import("node:http").Server): Promise<void> {
  return new Promise((resolve) => {
    if (server.listening) {
      resolve();
      return;
    }
    server.once("listening", resolve);
  });
}

async function run(): Promise<void> {
  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      await test.run();
      passed++;
      console.log(`✓ ${test.name}`);
    } catch (error) {
      failed++;
      console.error(`✗ ${test.name}`);
      console.error(error instanceof Error ? error.message : error);
    }
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) {
    process.exit(1);
  }
}

run();
