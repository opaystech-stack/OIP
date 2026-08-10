import { inMemory } from "@tanstack/ai-memory/in-memory";
import { OipRuntime } from "../packages/runtime/src/index.js";
import { OipRuntimeBuilder } from "../packages/runtime/src/builder.js";
import { TanStackMemoryRuntime } from "../packages/memory-runtime/src/index.js";
import type { RuntimeContext } from "../packages/core/src/index.js";
import { commercePluginModule } from "../examples/plugins/commerce/src/index.js";

function assertEqual(actual: unknown, expected: unknown): void {
  if (actual !== expected) {
    throw new Error(`Expected ${String(expected)}, received ${String(actual)}.`);
  }
}

function assertInstance(value: unknown, constructor: new (...args: never[]) => unknown): void {
  if (!(value instanceof constructor)) {
    throw new Error(`Expected instance of ${constructor.name}.`);
  }
}

const tests = [
  {
    name: "Legacy OipRuntime constructor still works",
    run: () => {
      const runtime = new OipRuntime().use(commercePluginModule);
      const capabilities = runtime.capabilities.list();
      assertEqual(capabilities.length > 0, true);
    },
  },
  {
    name: "OipRuntimeBuilder.withDefaults creates a working runtime",
    run: () => {
      const runtime = OipRuntimeBuilder.withDefaults().use(commercePluginModule);
      const capabilities = runtime.capabilities.list();
      assertEqual(capabilities.length > 0, true);
    },
  },
  {
    name: "OipRuntimeBuilder can be instantiated and returns an OipRuntime",
    run: () => {
      const runtime = new OipRuntimeBuilder().build();
      assertInstance(runtime, OipRuntime);
    },
  },
  {
    name: "OipRuntimeBuilder injects TanStack MemoryRuntime into the public runtime",
    run: async () => {
      const memoryRuntime = new TanStackMemoryRuntime(inMemory());
      const runtime = new OipRuntimeBuilder().withMemoryRuntime(memoryRuntime).build();
      const context: RuntimeContext = {
        requestId: "builder-memory-request",
        threadId: "builder-memory-thread",
        channel: "api",
        user: {
          userId: "builder-user",
          organizationId: "builder-tenant",
          roles: [],
        },
      };

      await runtime.memory.append({
        requestId: "builder-memory-entry",
        organizationId: "builder-tenant",
        userId: "builder-user",
        threadId: "builder-memory-thread",
        input: "Mémoire du builder",
        response: "Persistée via TanStack.",
        occurredAt: new Date().toISOString(),
      });
      const recent = await runtime.memory.recent(context, 10);
      assertEqual(recent.length > 0, true);
    },
  },
];

async function runTests(): Promise<void> {
  for (const test of tests) {
    await test.run();
    console.log(`ok - ${test.name}`);
  }
  console.log("\nAll RuntimeBuilder tests passed.");
}

runTests();
