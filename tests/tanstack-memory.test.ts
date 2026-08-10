import assert from "node:assert/strict";
import { inMemory } from "@tanstack/ai-memory/in-memory";
import type { ChatMiddlewareConfig, ChatMiddlewareContext } from "@tanstack/ai";
import {
  TanStackMemoryRuntime,
  TanStackMemoryStoreAdapter,
  createTanStackMemoryMiddleware,
  memoryScopeFromExecutionContext,
} from "../packages/memory-runtime/src/tanstack.js";
import type {
  ExecutionContext,
} from "../packages/core/src/contracts/index.js";
import type { RuntimeContext } from "../packages/core/src/index.js";
import { OipRuntime } from "../packages/runtime/src/index.js";

const tests = [
  {
    name: "TanStack MemoryRuntime saves and recalls within the trusted tenant/thread scope",
    run: async () => {
      const runtime = new TanStackMemoryRuntime(inMemory());
      const context = createExecutionContext("tenant-a", "user-a", "thread-a");

      await runtime.remember(context, "Quelle est la politique de stock ?", "Approbation requise.");
      const results = await runtime.recallForContext(context, "politique de stock");

      assert.ok(results.length > 0);
      assert.match(results[0]?.entry.content ?? "", /politique|Approbation/i);
      assert.deepEqual(memoryScopeFromExecutionContext(context), {
        tenantId: "tenant-a",
        userId: "user-a",
        threadId: "thread-a",
        namespace: "oip",
      });
    },
  },
  {
    name: "TanStack MemoryRuntime rejects recall from another tenant",
    run: async () => {
      const runtime = new TanStackMemoryRuntime(inMemory());
      const tenantA = createExecutionContext("tenant-a", "user-a", "thread-a");
      const tenantB = createExecutionContext("tenant-b", "user-a", "thread-a");

      await runtime.remember(tenantA, "Secret tenant A", "Ne jamais exposer.");
      const results = await runtime.recallForContext(tenantB, "Secret tenant A");

      assert.equal(results.length, 0);
    },
  },
  {
    name: "TanStack MemoryRuntime rejects a context without a validated thread",
    run: async () => {
      const runtime = new TanStackMemoryRuntime(inMemory());
      const context = createExecutionContext("tenant-a", "user-a", "thread-a");
      const { threadId: _threadId, ...contextWithoutThread } = context;

      await assert.rejects(
        runtime.recallForContext(contextWithoutThread as unknown as ExecutionContext, "anything"),
        /trusted validated threadId/i,
      );
    },
  },
  {
    name: "TanStack MemoryStore adapter preserves legacy append/recent callers",
    run: async () => {
      const runtime = new TanStackMemoryRuntime(inMemory());
      const store = new TanStackMemoryStoreAdapter(runtime);
      const context: RuntimeContext = {
        requestId: "legacy-request",
        threadId: "thread-legacy",
        channel: "api",
        user: {
          userId: "user-legacy",
          organizationId: "tenant-legacy",
          roles: [],
        },
      };

      await store.append({
        requestId: "legacy-memory-1",
        organizationId: "tenant-legacy",
        userId: "user-legacy",
        threadId: "thread-legacy",
        input: "Règle de réassort",
        response: "Seuil de 10 unités.",
        occurredAt: new Date().toISOString(),
        metadata: {},
      });
      const recent = await store.recent(context, 10);

      assert.equal(recent.length, 2);
      assert.ok(recent.some((entry) => entry.input === "Règle de réassort"));
      assert.ok(recent.some((entry) => entry.input === "Seuil de 10 unités."));
    },
  },
  {
    name: "OipRuntime accepts an injectable TanStack MemoryAdapter provider",
    run: async () => {
      const runtime = new OipRuntime({
        memoryAdapter: inMemory(),
        memoryNamespace: "production-memory",
      });
      const context: RuntimeContext = {
        requestId: "provider-runtime-request",
        threadId: "provider-runtime-thread",
        channel: "api",
        user: {
          userId: "provider-user",
          organizationId: "provider-tenant",
          roles: [],
        },
      };

      await runtime.memory.append({
        requestId: "provider-memory-entry",
        organizationId: "provider-tenant",
        userId: "provider-user",
        threadId: "provider-runtime-thread",
        input: "Provider injectable",
        response: "TanStack est branché.",
        occurredAt: new Date().toISOString(),
      });
      const recent = await runtime.memory.recent(context, 10);

      assert.ok(recent.some((entry) => entry.input === "Provider injectable"));
    },
  },
  {
    name: "TanStack memoryMiddleware uses only the server-derived ExecutionContext scope",
    run: async () => {
      const runtime = new TanStackMemoryRuntime(inMemory());
      const trustedContext = createExecutionContext("tenant-a", "user-a", "server-thread-a");
      await runtime.remember(trustedContext, "Mémoire protégée", "Réponse protégée.");

      const deferred: Promise<unknown>[] = [];
      const middleware = createTanStackMemoryMiddleware({
        adapter: runtime.adapter,
        executionContext: async () => trustedContext,
      });
      const chatContext = fakeChatContext("client-supplied-thread", deferred);
      const config: ChatMiddlewareConfig = {
        messages: [{ role: "user", content: "Mémoire protégée" }],
        systemPrompts: [],
        tools: [],
      };

      const transformed = await middleware.onConfig?.(chatContext, config);
      assert.ok(transformed?.systemPrompts?.some((prompt) => /Réponse protégée/i.test(String(prompt))));

      await middleware.onFinish?.(chatContext, {
        content: "Nouvelle réponse",
        duration: 1,
        finishReason: "stop",
      });
      await Promise.all(deferred);

      const saved = await runtime.recallForContext(trustedContext, "Nouvelle réponse");
      assert.ok(saved.length > 0);
      assert.equal(middleware.name, "memory:in-memory");
    },
  },
];

function createExecutionContext(
  organizationId: string,
  userId: string,
  threadId: string,
): ExecutionContext {
  return {
    requestId: `${organizationId}-${userId}-${threadId}`,
    threadId,
    identity: {
      userId,
      organizationId,
      roles: [],
      locale: "fr",
    },
    channel: "api",
  };
}

function fakeChatContext(
  clientThreadId: string,
  deferred: Promise<unknown>[],
): ChatMiddlewareContext<unknown> {
  return {
    requestId: "chat-request",
    streamId: "chat-stream",
    runId: "chat-run",
    threadId: clientThreadId,
    phase: "init",
    iteration: 0,
    chunkIndex: 0,
    context: undefined,
    defer: (promise) => deferred.push(promise),
    activity: "chat",
    provider: "test",
    model: "test-model",
    source: "server",
    streaming: false,
    systemPrompts: [],
    messageCount: 1,
    hasTools: false,
    currentMessageId: null,
    accumulatedContent: "",
    messages: [{ role: "user", content: "Mémoire protégée" }],
    createId: (prefix) => `${prefix}-id`,
    capabilities: {} as ChatMiddlewareContext<unknown>["capabilities"],
    get: () => { throw new Error("not used"); },
    getOptional: () => undefined,
    provide: () => undefined,
    abort: () => undefined,
  };
}

async function runTests(): Promise<void> {
  for (const test of tests) {
    await test.run();
    console.log(`ok - ${test.name}`);
  }
}

void runTests();
