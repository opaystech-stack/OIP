import {
  ActionEngine,
  type CapabilityDefinition,
  CapabilityRegistry,
  type JsonObject,
  registerPlugin,
  ToolRegistry,
  type ToolHandler,
  Validator,
  type RuntimeContext,
} from "../packages/core/src/index.js";
import { InMemoryAuditLog } from "../packages/audit-log/src/index.js";
import { ChatService } from "../packages/chat-service/src/index.js";
import { createLlmAdapter, loadLlmConfig } from "../packages/config/src/index.js";
import { ContextBuilder } from "../packages/context-builder/src/index.js";
import { InMemoryEventBus } from "../packages/event-bus/src/index.js";
import { InMemoryKnowledgeSource, KnowledgeEngine } from "../packages/knowledge-engine/src/index.js";
import { MockLlmAdapter, OpenAiCompatibleLlmAdapter } from "../packages/llm-adapter/src/index.js";
import { LlmPlanner } from "../packages/planner/src/index.js";
import { installPluginModule } from "../packages/plugin-sdk/src/index.js";
import { OipRuntime } from "../packages/runtime/src/index.js";
import { WorkflowEngine, WorkflowRegistry } from "../packages/workflow-engine/src/index.js";
import { commercePluginModule } from "../plugins/commerce/src/index.js";
import { getEmployeesSnapshot, hrPluginModule } from "../plugins/hr/src/index.js";
import { startApiServer } from "../apps/api/src/server.js";

type TestCase = {
  readonly name: string;
  readonly run: () => Promise<void>;
};

function createEngine(): {
  capabilities: CapabilityRegistry;
  tools: ToolRegistry;
  actionEngine: ActionEngine;
  eventBus: InMemoryEventBus;
  auditLog: InMemoryAuditLog;
  workflowEngine: WorkflowEngine;
} {
  const capabilities = new CapabilityRegistry();
  const tools = new ToolRegistry();
  const eventBus = new InMemoryEventBus();
  const auditLog = new InMemoryAuditLog();
  const workflowRegistry = new WorkflowRegistry();

  const actionEngine = new ActionEngine(capabilities, tools, new Validator(), eventBus, auditLog);
  installPluginModule(commercePluginModule, {
    capabilities,
    tools,
    workflows: workflowRegistry,
  });

  return {
    capabilities,
    tools,
    actionEngine,
    eventBus,
    auditLog,
    workflowEngine: new WorkflowEngine(workflowRegistry, actionEngine),
  };
}

function createContext(roles: readonly string[]): RuntimeContext {
  return {
    requestId: "test-request",
    channel: "web",
    user: {
      userId: "user-test",
      organizationId: "org-test",
      roles,
      locale: "fr-CD",
      activeModule: "commerce",
      activePage: "inventory",
    },
  };
}

function createConfirmedContext(roles: readonly string[], capabilityId: string): RuntimeContext {
  return {
    ...createContext(roles),
    metadata: {
      confirmedCapabilities: [capabilityId],
    },
  };
}

const tests: readonly TestCase[] = [
  {
    name: "LLM planner output can execute a registered Commerce capability",
    run: async () => {
      const { capabilities, actionEngine, eventBus, auditLog } = createEngine();
      const planner = new LlmPlanner(
        new MockLlmAdapter(() => ({
          capabilityId: "commerce.inventory.add",
          arguments: {
            itemName: "sacs de ciment",
            quantity: 20,
          },
          confidence: 0.91,
          reason: "The user asked to add stock.",
        })),
        capabilities.list(),
      );

      const plan = await planner.plan("Ajoute 20 sacs de ciment au stock");
      const result = await actionEngine.execute(plan, createContext(["inventory.manager"]));

      assertEqual(plan.capabilityId, "commerce.inventory.add");
      assertEqual(result.status, "completed");
      assertEqual(result.events[0]?.type, "InventoryUpdated");
      assertEqual(eventBus.list()[0]?.event.type, "InventoryUpdated");
      assertEqual(auditLog.list()[0]?.status, "completed");
    },
  },
  {
    name: "Validator rejects execution when the user lacks the required role",
    run: async () => {
      const { actionEngine, auditLog } = createEngine();

      const result = await actionEngine.execute(
        {
          capabilityId: "commerce.inventory.add",
          arguments: {
            itemName: "sacs de ciment",
            quantity: 20,
          },
          confidence: 1,
          reason: "Direct test plan.",
        },
        createContext(["cashier"]),
      );

      assertEqual(result.status, "rejected");
      assertEqual(result.events.length, 0);
      assertEqual(result.data?.issues instanceof Array, true);
      assertEqual(auditLog.list()[0]?.reason, "validation_failed");
    },
  },
  {
    name: "LLM planner rejects malformed JSON plans before execution",
    run: async () => {
      const { capabilities } = createEngine();
      const planner = new LlmPlanner(
        new MockLlmAdapter(() => ({
          capabilityId: "commerce.inventory.add",
          arguments: "not-an-object",
          confidence: 0.5,
          reason: "Malformed test.",
        })),
        capabilities.list(),
      );

      await assertRejects(
        () => planner.plan("Ajoute au stock"),
        "missing object arguments",
      );
    },
  },
  {
    name: "Workflow engine orchestrates Commerce capabilities through Action Engine",
    run: async () => {
      const { workflowEngine, eventBus } = createEngine();

      const result = await workflowEngine.execute(
        "commerce.workflow.restock",
        {
          itemName: "cartons de savon",
          quantity: 12,
        },
        createContext(["inventory.manager"]),
      );

      assertEqual(result.status, "completed");
      assertEqual(result.steps[0]?.capabilityId, "commerce.inventory.add");
      assertEqual(eventBus.list()[0]?.event.type, "InventoryUpdated");
    },
  },
  {
    name: "Context builder enriches runtime context with knowledge results",
    run: async () => {
      const knowledge = new KnowledgeEngine();
      knowledge.register(
        new InMemoryKnowledgeSource("commerce-docs", "Commerce Docs", [
          {
            title: "Stock ciment",
            content: "Le ciment est gere dans le module inventaire Commerce.",
            metadata: { module: "commerce" },
          },
        ]),
      );

      const built = await new ContextBuilder(knowledge).build(
        "Comment gerer le stock de ciment ?",
        createContext(["inventory.manager"]),
      );

      assertEqual(built.runtime.user.activeModule, "commerce");
      assertEqual(built.knowledge[0]?.sourceId, "commerce-docs");
      assertEqual(built.metadata.activeModule, "commerce");
      assertEqual(built.memory.length, 0);
    },
  },
  {
    name: "OIP runtime installs a plugin and executes an LLM-planned action",
    run: async () => {
      const runtime = new OipRuntime().use(commercePluginModule);
      const planner = runtime.createPlanner(
        new MockLlmAdapter(() => ({
          capabilityId: "commerce.inventory.add",
          arguments: {
            itemName: "boites de peinture",
            quantity: 4,
          },
          confidence: 0.9,
          reason: "The user wants to add inventory.",
        })),
      );

      const plan = await planner.plan("Ajoute 4 boites de peinture au stock");
      const result = await runtime.execute(plan, createContext(["inventory.manager"]));

      assertEqual(result.status, "completed");
      assertEqual(runtime.events.list()[0]?.event.type, "InventoryUpdated");
    },
  },
  {
    name: "OpenAI-compatible adapter parses JSON content from chat completions",
    run: async () => {
      const adapter = new OpenAiCompatibleLlmAdapter({
        baseUrl: "https://example.test/v1/",
        apiKey: "test-key",
        model: "test-model",
        fetch: async (url, init) => {
          assertEqual(url, "https://example.test/v1/chat/completions");
          assertEqual(init.method, "POST");

          return {
            ok: true,
            status: 200,
            text: async () => "",
            json: async () => ({
              choices: [
                {
                  message: {
                    content: JSON.stringify({
                      capabilityId: "commerce.inventory.add",
                      arguments: { itemName: "ciment", quantity: 2 },
                      confidence: 0.88,
                      reason: "Parsed by model.",
                    }),
                  },
                },
              ],
            }),
          };
        },
      });

      const result = await adapter.generateJson({
        schemaName: "oip.planned_action.v1",
        messages: [{ role: "user", content: "Ajoute 2 ciments" }],
      });

      assertEqual(result.capabilityId, "commerce.inventory.add");
    },
  },
  {
    name: "Chat service runs context, planning and action execution end to end",
    run: async () => {
      const runtime = new OipRuntime().use(commercePluginModule);
      const chat = new ChatService(
        runtime,
        new MockLlmAdapter(() => ({
          capabilityId: "commerce.inventory.add",
          arguments: {
            itemName: "bidons de peinture",
            quantity: 6,
          },
          confidence: 0.93,
          reason: "End-to-end chat test.",
        })),
      );

      const response = await chat.handle({
        input: "Ajoute 6 bidons de peinture au stock",
        context: createContext(["inventory.manager"]),
      });
      const memory = await runtime.memory.recent(createContext(["inventory.manager"]), 5);

      assertEqual(response.message, "Action executee avec succes.");
      assertEqual(response.plan.capabilityId, "commerce.inventory.add");
      assertEqual(response.action.status, "completed");
      assertEqual(memory[0]?.input, "Ajoute 6 bidons de peinture au stock");
      assertEqual(runtime.observability.list()[0]?.name, "chat.handle");
      assertEqual(runtime.observability.list()[0]?.status, "completed");
    },
  },
  {
    name: "LLM config creates mock adapter by default",
    run: async () => {
      const config = loadLlmConfig({});
      const adapter = createLlmAdapter(config);
      const result = await adapter.generateJson({
        schemaName: "test",
        messages: [{ role: "user", content: "test" }],
      });

      assertEqual(config.provider, "mock");
      assertEqual(result.capabilityId, "commerce.inventory.add");
    },
  },
  {
    name: "Document service ingests text into searchable knowledge",
    run: async () => {
      const runtime = new OipRuntime().use(commercePluginModule);
      const ingested = runtime.documents.ingest({
        title: "Procedure inventaire",
        text: "Pour le stock de ciment, utiliser la capability inventory add dans Commerce.",
        metadata: { module: "commerce" },
      });
      const results = await runtime.knowledge.search("stock ciment", createContext(["inventory.manager"]));

      assertEqual(ingested.chunkCount, 1);
      assertEqual(results[0]?.sourceId, "documents");
      assertEqual(results[0]?.metadata.documentTitle, "Procedure inventaire");
    },
  },
  {
    name: "Action engine blocks sensitive capabilities until explicitly confirmed",
    run: async () => {
      const { capabilities, tools, actionEngine, auditLog } = createEngine();
      const sensitiveCapability: CapabilityDefinition = {
        id: "commerce.payment.refund",
        description: "Refund a customer payment.",
        parameters: [
          {
            name: "paymentId",
            type: "string",
            required: true,
            description: "Payment identifier.",
          },
        ],
        requiredRoles: ["finance.manager"],
        confirmationLevel: "high",
        sideEffects: ["money_leaves_account"],
        emits: ["PaymentRefunded"],
      };
      const refundTool: ToolHandler = {
        async execute(args: JsonObject) {
          return {
            capabilityId: sensitiveCapability.id,
            status: "completed",
            data: args,
            events: [
              {
                type: "PaymentRefunded",
                payload: args,
                occurredAt: new Date().toISOString(),
              },
            ],
          };
        },
      };

      capabilities.register(sensitiveCapability);
      tools.register(sensitiveCapability.id, refundTool);

      const rejected = await actionEngine.execute(
        {
          capabilityId: sensitiveCapability.id,
          arguments: { paymentId: "pay-001" },
          confidence: 1,
          reason: "Test sensitive action.",
        },
        createContext(["finance.manager"]),
      );

      const confirmed = await actionEngine.execute(
        {
          capabilityId: sensitiveCapability.id,
          arguments: { paymentId: "pay-001" },
          confidence: 1,
          reason: "Test sensitive action.",
        },
        createConfirmedContext(["finance.manager"], sensitiveCapability.id),
      );

      assertEqual(rejected.status, "rejected");
      assertEqual(confirmed.status, "completed");
      assertEqual(auditLog.list()[0]?.reason, "confirmation_required");
      assertEqual(auditLog.list()[1]?.status, "completed");
    },
  },
  {
    name: "OIP runtime supports multiple business plugins without core changes",
    run: async () => {
      const runtime = new OipRuntime().use(commercePluginModule).use(hrPluginModule);

      const result = await runtime.execute(
        {
          capabilityId: "hr.employee.create",
          arguments: {
            fullName: "Patrick Mavungu",
            role: "Comptable",
          },
          confidence: 0.95,
          reason: "Create employee test.",
        },
        createConfirmedContext(["hr.manager"], "hr.employee.create"),
      );

      assertEqual(result.status, "completed");
      assertEqual(result.events[0]?.type, "EmployeeCreated");
      assertEqual(getEmployeesSnapshot().at(-1)?.fullName, "Patrick Mavungu");
    },
  },
  {
    name: "API server exposes health, capabilities, chat and admin state",
    run: async () => {
      const server = startApiServer({ port: 0 });

      try {
        await waitForServer();
        const address = server.address();

        if (!address || typeof address === "string") {
          throw new Error("Test server did not expose a TCP address.");
        }

        const baseUrl = `http://127.0.0.1:${address.port}`;
        const health = await fetchJson(`${baseUrl}/health`);
        const capabilities = await fetchJson(`${baseUrl}/capabilities`);
        const chat = await fetchJson(`${baseUrl}/chat`, {
          method: "POST",
          body: JSON.stringify({
            input: "Ajoute 20 sacs de ciment au stock",
            user: {
              userId: "user-001",
              organizationId: "opays-demo",
              roles: ["inventory.manager"],
              locale: "fr-CD",
            },
          }),
        });
        const action = await fetchJson(`${baseUrl}/actions`, {
          method: "POST",
          body: JSON.stringify({
            capabilityId: "hr.employee.create",
            arguments: {
              fullName: "Grace Mbala",
              role: "RH",
            },
            confirmedCapabilities: ["hr.employee.create"],
            user: {
              userId: "user-hr",
              organizationId: "opays-demo",
              roles: ["hr.manager"],
              locale: "fr-CD",
            },
          }),
        });
        const audit = await fetchJson(`${baseUrl}/admin/audit`);
        const traces = await fetchJson(`${baseUrl}/admin/traces`);
        const events = await fetchJson(`${baseUrl}/admin/events`);

        assertEqual(health.status, "ok");
        assertEqual(Array.isArray(capabilities.capabilities), true);
        assertEqual(getObject(chat.action).status, "completed");
        assertEqual(action.status, "completed");
        assertEqual(Array.isArray(audit.records), true);
        assertEqual(Array.isArray(traces.traces), true);
        assertEqual(Array.isArray(events.events), true);
      } finally {
        await closeServer(server);
      }
    },
  },
];

for (const testCase of tests) {
  await testCase.run();
  console.log(`ok - ${testCase.name}`);
}

function assertEqual(actual: unknown, expected: unknown): void {
  if (actual !== expected) {
    throw new Error(`Expected ${String(expected)}, received ${String(actual)}.`);
  }
}

async function assertRejects(action: () => Promise<unknown>, expectedMessage: string): Promise<void> {
  try {
    await action();
  } catch (error) {
    if (error instanceof Error && error.message.includes(expectedMessage)) {
      return;
    }

    throw error;
  }

  throw new Error(`Expected action to reject with message containing: ${expectedMessage}`);
}

async function fetchJson(url: string, init?: RequestInit): Promise<Record<string, unknown>> {
  const response = await fetch(url, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${await response.text()}`);
  }

  const payload = (await response.json()) as unknown;

  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    throw new Error("Expected JSON object response.");
  }

  return payload as Record<string, unknown>;
}

function waitForServer(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 50));
}

function getObject(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Expected object value.");
  }

  return value as Record<string, unknown>;
}

function closeServer(server: { close(callback: (error?: Error) => void): void }): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error?: Error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}
