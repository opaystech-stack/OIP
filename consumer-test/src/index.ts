import {
  ActionEngine,
  CapabilityRegistry,
  defineCapability,
  defineTool,
  type OipPlugin,
  registerPlugin,
  type RuntimeContext,
  success,
  ToolRegistry,
  Validator,
} from "@opaystech/oip/core";
import { OipRuntime } from "@opaystech/oip";
import { definePlugin, definePluginModule } from "@opaystech/oip/plugin-sdk";
import { MockLlmAdapter } from "@opaystech/oip/llm-adapter";

// ---------------------------------------------------------------------------
// 1. Minimal capability declaration
// ---------------------------------------------------------------------------

const sayHelloCapability = defineCapability({
  id: "demo.greeting.sayHello",
  description: "Greet a user by name.",
  parameters: [
    {
      name: "name",
      type: "string",
      required: true,
      description: "Name of the person to greet.",
    },
  ],
  requiredRoles: ["user"],
  confirmationLevel: "none",
  sideEffects: [],
  emits: ["GreetingSent"],
});

const addNumbersCapability = defineCapability({
  id: "demo.math.add",
  description: "Add two numbers.",
  parameters: [
    { name: "a", type: "number", required: true, description: "First number." },
    { name: "b", type: "number", required: true, description: "Second number." },
  ],
  requiredRoles: ["user"],
  confirmationLevel: "none",
  sideEffects: [],
  emits: ["SumComputed"],
});

// ---------------------------------------------------------------------------
// 2. Tool implementations via defineTool helper and success() helper
// ---------------------------------------------------------------------------

const sayHelloTool = defineTool(async (args, _context) => {
  const name = String(args.name);
  return success("demo.greeting.sayHello", { message: `Hello, ${name}!` }, [
    {
      type: "GreetingSent",
      occurredAt: new Date().toISOString(),
      payload: { name },
    },
  ]);
});

const addNumbersTool = defineTool(async (args, _context) => {
  const a = Number(args.a);
  const b = Number(args.b);
  const sum = a + b;
  return success("demo.math.add", { sum }, [
    {
      type: "SumComputed",
      occurredAt: new Date().toISOString(),
      payload: { a, b, sum },
    },
  ]);
});

// ---------------------------------------------------------------------------
// 3. Plugin definition via definePlugin helper
// ---------------------------------------------------------------------------

const demoPlugin: OipPlugin = definePlugin({
  id: "demo",
  name: "Consumer Test Demo Plugin",
  capabilities: [sayHelloCapability, addNumbersCapability],
  tools: new Map([
    ["demo.greeting.sayHello", sayHelloTool],
    ["demo.math.add", addNumbersTool],
  ]),
});

const demoPluginModule = definePluginModule({
  plugin: demoPlugin,
});

// ---------------------------------------------------------------------------
// 4. Runtime context
// ---------------------------------------------------------------------------

const context: RuntimeContext = {
  requestId: "consumer-test-001",
  channel: "web",
  user: {
    userId: "consumer-user",
    organizationId: "opays-consumer-test",
    roles: ["user"],
    locale: "fr-CD",
  },
};

// ---------------------------------------------------------------------------
// 5. Execute via OipRuntime facade
// ---------------------------------------------------------------------------

async function runOipRuntimeDemo() {
  const runtime = new OipRuntime().use(demoPluginModule);

  const planner = runtime.createPlanner(
    new MockLlmAdapter(() => ({
      capabilityId: "demo.greeting.sayHello",
      arguments: { name: "World" },
      confidence: 0.99,
      reason: "The user wants to be greeted.",
    })),
  );

  const plan = await planner.plan("Say hello to World");
  const result = await runtime.execute(plan, context);

  console.log("OipRuntime result:", JSON.stringify(result, null, 2));
}

// ---------------------------------------------------------------------------
// 6. Execute via raw core API
// ---------------------------------------------------------------------------

async function runCoreApiDemo() {
  const capabilities = new CapabilityRegistry();
  const tools = new ToolRegistry();
  const actionEngine = new ActionEngine(capabilities, tools, new Validator());

  registerPlugin(demoPlugin, capabilities, tools);

  const result = await actionEngine.execute(
    {
      capabilityId: "demo.math.add",
      arguments: { a: 3, b: 5 },
      confidence: 1,
      reason: "Direct core API test.",
    },
    context,
  );

  console.log("Core API result:", JSON.stringify(result, null, 2));
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("Running Consumer Test Project for OIP...\n");
  await runOipRuntimeDemo();
  console.log("");
  await runCoreApiDemo();
  console.log("\nConsumer Test completed.");
}

main().catch((error) => {
  console.error("Consumer Test failed:", error);
  process.exit(1);
});
