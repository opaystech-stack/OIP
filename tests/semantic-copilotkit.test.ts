import { SemanticDispatcher, SemanticIntentRouter, ManifestClient, type PageContext, type RenderUiDirective } from "../packages/semantic-dispatcher/src/index.js";
import type { HttpResponse, FetchLike, HqExecutionResult } from "../packages/hq-connector/src/index.js";
import type { SemanticManifest } from "../packages/hq-connector/src/manifest.js";
import type { Intention } from "../packages/core/src/contracts/intention.js";
import type { ExecutionContext } from "../packages/core/src/contracts/context.js";
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

function makeIntention(goal: string, entities: Array<{ name: string; value: unknown }>, confidence = 0.9): Intention {
  return {
    goal,
    rawText: goal,
    type: goal,
    confidence,
    entities: entities.map((e) => ({
      name: e.name,
      value: e.value as import("../packages/core/src/index.js").JsonValue,
    })),
  };
}

const executionContext: ExecutionContext = {
  requestId: "req-42",
  identity: {
    userId: "user-1",
    organizationId: "org-1",
    workspaceId: "ws-1",
    roles: ["ceo"],
    scopes: [],
    permissions: [],
  },
  workspace: { id: "ws-1", name: "Test", plugins: [], locale: "fr", settings: {} },
  channel: "web",
  locale: "fr",
} as unknown as ExecutionContext;

const manifest: SemanticManifest = {
  product: "Opays-HQ",
  version: "1.0.0",
  entities: {
    Invoice: {
      description: "Client invoice",
      fields: {
        id: { type: "uuid", readonly: true },
        amount: { type: "currency", required: true },
        status: { type: "enum", values: ["draft", "sent", "paid"] },
      },
      operations: {
        read: { roles: ["ceo", "sales", "accountant"] },
        update_status: { roles: ["ceo", "accountant"] },
        render_ui: { roles: ["ceo", "sales", "accountant"] },
      },
    },
  },
};

const tests: readonly { readonly name: string; readonly run: () => Promise<void> }[] = [
  {
    name: "page_context enriches payload with active entity_id and selection",
    run: async () => {
      const { client: manifestClient } = buildManifestClient(manifest);
      const { connector, calls: execCalls } = buildConnector({
        status: "completed",
        httpStatus: 200,
        data: { id: "inv-7", status: "paid" },
      });
      const dispatcher = new SemanticDispatcher({
        manifestClient,
        connector,
        product: "Opays-HQ",
      });

      const pageContext: PageContext = {
        product: "Opays-HQ",
        manifestVersion: "1.0.0",
        route: "/app/invoices/inv-7",
        entity: "Invoice",
        entityId: "inv-7",
        view: "detail",
        selection: { reason: "late_payment" },
        locale: "fr-FR",
        userRole: "ceo",
      };

      const router = new SemanticIntentRouter({ dispatcher, pageContext });
      const intention = makeIntention("update invoice", [
        { name: "entity", value: "Invoice" },
        { name: "operation", value: "update_status" },
        { name: "status", value: "paid" },
        { name: "amount", value: 1000 },
      ]);

      const result = await router.execute(intention, executionContext);

      assertEqual(result.status, "completed");
      assertEqual(execCalls.length, 1);
      assertEqual(execCalls[0]?.id, "semantic/Invoice/update_status");
      // entity_id from page_context should be merged into payload
      assertEqual(execCalls[0]?.args.invoice_id, "inv-7");
      assertEqual(execCalls[0]?.args.reason, "late_payment");
      assertEqual(execCalls[0]?.args.status, "paid");
      assertEqual(execCalls[0]?.args.amount, 1000);
    },
  },
  {
    name: "custom resolver uses page_context to resolve ambiguous 'show it'",
    run: async () => {
      const { client: manifestClient } = buildManifestClient(manifest);
      const { connector, calls: execCalls } = buildConnector({ status: "completed", httpStatus: 200, data: {} });
      const dispatcher = new SemanticDispatcher({
        manifestClient,
        connector,
        product: "Opays-HQ",
        renderCatalogue: { Invoice: ["InvoicePaymentForm", "InvoiceTable"] },
      });

      const pageContext: PageContext = {
        product: "Opays-HQ",
        manifestVersion: "1.0.0",
        route: "/app/invoices/inv-7",
        entity: "Invoice",
        entityId: "inv-7",
        view: "detail",
        locale: "fr-FR",
        userRole: "ceo",
      };

      const router = new SemanticIntentRouter({
        dispatcher,
        pageContext,
        resolve: (_intent, ctx) => {
          if (ctx?.entity) {
            return { entity: ctx.entity, operation: "render_ui" };
          }
          return undefined;
        },
      });

      const intention = makeIntention("show it", [
        { name: "component", value: "InvoiceTable" },
        { name: "mode", value: "list" },
      ]);
      const result = await router.execute(intention, executionContext);

      assertEqual(result.status, "render_ui");
      if (result.status === "render_ui") {
        assertEqual(result.render?.component, "InvoiceTable");
        assertEqual(result.render?.entity, "Invoice");
        assertEqual(result.render?.mode, "list");
      }
      assertEqual(execCalls.length, 0);
    },
  },
    {
    name: "render_ui operation returns a RenderUiDirective without product call",
    run: async () => {
      const { client: manifestClient } = buildManifestClient(manifest);
      const { connector, calls: execCalls } = buildConnector({ status: "completed", httpStatus: 200, data: {} });
      const dispatcher = new SemanticDispatcher({
        manifestClient,
        connector,
        product: "Opays-HQ",
        renderCatalogue: { Invoice: ["InvoicePaymentForm", "InvoiceTable"] },
      });

      const pageContext: PageContext = {
        product: "Opays-HQ",
        manifestVersion: "1.0.0",
        route: "/app/invoices/inv-7",
        entity: "Invoice",
        entityId: "inv-7",
        view: "detail",
        selection: { amount_due: 500 },
        locale: "fr-FR",
        userRole: "ceo",
      };

      const router = new SemanticIntentRouter({ dispatcher, pageContext });
      const intention = makeIntention("pay invoice", [
        { name: "entity", value: "Invoice" },
        { name: "operation", value: "render_ui" },
        { name: "component", value: "InvoicePaymentForm" },
        { name: "mode", value: "edit" },
      ]);

      const result = await router.execute(intention, executionContext);

      assertEqual(result.status, "render_ui");
      if (result.status === "render_ui") {
        const render = result.render as RenderUiDirective;
        assertEqual(render.action, "render_ui");
        assertEqual(render.component, "InvoicePaymentForm");
        assertEqual(render.entity, "Invoice");
        assertEqual(render.mode, "edit");
        assertEqual(render.prefill.amount_due, 500);
        assertEqual(render.prefill.invoice_id, "inv-7");
        assertEqual(render.onSubmit, "execute(entity=Invoice, operation=create, payload=$form)");
      }
      assertEqual(execCalls.length, 0);
    },
  },
  {
    name: "render_ui rejects unknown component not in catalogue",
    run: async () => {
      const { client: manifestClient } = buildManifestClient(manifest);
      const { connector, calls: execCalls } = buildConnector({ status: "completed", httpStatus: 200, data: {} });
      const dispatcher = new SemanticDispatcher({
        manifestClient,
        connector,
        product: "Opays-HQ",
        renderCatalogue: { Invoice: ["InvoicePaymentForm"] },
      });

      const router = new SemanticIntentRouter({ dispatcher });
      const intention = makeIntention("custom ui", [
        { name: "entity", value: "Invoice" },
        { name: "operation", value: "render_ui" },
        { name: "component", value: "MagicWidget" },
      ]);

      const result = await router.execute(intention, executionContext);

      assertEqual(result.status, "invalid");
      assertEqual(execCalls.length, 0);
    },
  },
  {
    name: "render_ui without catalogue returns invalid",
    run: async () => {
      const { client: manifestClient } = buildManifestClient(manifest);
      const { connector, calls: execCalls } = buildConnector({ status: "completed", httpStatus: 200, data: {} });
      const dispatcher = new SemanticDispatcher({ manifestClient, connector, product: "Opays-HQ" });

      const router = new SemanticIntentRouter({ dispatcher });
      const intention = makeIntention("show form", [
        { name: "entity", value: "Invoice" },
        { name: "operation", value: "render_ui" },
      ]);

      const result = await router.execute(intention, executionContext);

      assertEqual(result.status, "invalid");
      assertEqual(execCalls.length, 0);
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
