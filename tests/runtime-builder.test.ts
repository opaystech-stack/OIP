import { OipRuntime } from "../packages/runtime/src/index.js";
import { OipRuntimeBuilder } from "../packages/runtime/src/builder.js";
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
];

async function runTests(): Promise<void> {
  for (const test of tests) {
    await test.run();
    console.log(`ok - ${test.name}`);
  }
  console.log("\nAll RuntimeBuilder tests passed.");
}

runTests();
