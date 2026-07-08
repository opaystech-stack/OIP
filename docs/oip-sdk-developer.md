# SDK developpeur OIP — Guide minimal

Ce document decrit l’essentiel pour integrer OIP dans une application Opays.

> Ce n’est pas encore un SDK complet. Il s’agit de la **premiere base documentee** de l’API publique stabilisee pendant le PI-1.

## Installation

```bash
npm install @opaystech/oip@0.1.0-alpha
```

Avec GitHub Packages (configuration `.npmrc` requise) :

```ini
@opaystech:registry=https://npm.pkg.github.com
```

## API publique stable

Les seuls chemins d’import publics sont :

```ts
import { OipRuntime, createRuntimeFromEnv } from "@opaystech/oip";
import { defineCapability, CapabilityRegistry, ToolRegistry, ActionEngine, Validator, registerPlugin } from "@opaystech/oip/core";
import { definePluginModule, installPluginModule } from "@opaystech/oip/plugin-sdk";
import { loadLlmConfig, createLlmAdapter } from "@opaystech/oip/config";
import { MockLlmAdapter, OpenAiCompatibleLlmAdapter } from "@opaystech/oip/llm-adapter";
import { VectorAdapter, DocumentAdapter, OcrAdapter } from "@opaystech/oip/adapters";
```

Tout autre chemin est interne et peut evoluer sans notice.

## 1. Initialiser le moteur

### Facade simple

```ts
import { OipRuntime } from "@opaystech/oip";

const runtime = new OipRuntime();
```

### Depuis l’environnement

```ts
import { createRuntimeFromEnv } from "@opaystech/oip";

const runtime = createRuntimeFromEnv();
```

Variables supportees :

- `OIP_DATA_DIR` : repertoire de persistance JSON pour memory, audit et evenements.
- `OIP_LLM_PROVIDER` : `mock` ou `openai-compatible`.
- `OIP_LLM_BASE_URL`, `OIP_LLM_API_KEY`, `OIP_LLM_MODEL`.

## 2. Declarer une Capability

Une capability est le seul point de contact entre le langage naturel et l’action metier.

```ts
import { defineCapability } from "@opaystech/oip/core";

const addStockCapability = defineCapability({
  id: "commerce.inventory.add",
  description: "Ajouter une quantite a un article de stock.",
  parameters: [
    { name: "itemName", type: "string", required: true, description: "Nom de l’article" },
    { name: "quantity", type: "number", required: true, description: "Quantite a ajouter" },
  ],
  requiredRoles: ["inventory.manager"],
  confirmationLevel: "low",
  sideEffects: ["inventory_quantity_increases"],
  emits: ["InventoryUpdated"],
});
```

## 3. Implementer un Tool

```ts
import type { ToolHandler, ActionResult, RuntimeContext, JsonObject } from "@opaystech/oip/core";

class AddInventoryTool implements ToolHandler {
  async execute(args: JsonObject, _context: RuntimeContext): Promise<ActionResult> {
    // Appeler le service metier ici, jamais depuis le LLM.
    return {
      capabilityId: "commerce.inventory.add",
      status: "completed",
      data: { itemName: String(args.itemName), quantityAdded: Number(args.quantity) },
      events: [{
        type: "InventoryUpdated",
        occurredAt: new Date().toISOString(),
        payload: args,
      }],
    };
  }
}
```

## 4. Enregistrer un plugin

```ts
import { registerPlugin } from "@opaystech/oip/core";

const capabilities = new CapabilityRegistry();
const tools = new ToolRegistry();

registerPlugin(
  {
    id: "commerce",
    name: "Opays Commerce",
    capabilities: [addStockCapability],
    tools: new Map([["commerce.inventory.add", new AddInventoryTool()]]),
  },
  capabilities,
  tools,
);
```

Avec le Plugin SDK (recommande) :

```ts
import { definePluginModule, installPluginModule } from "@opaystech/oip/plugin-sdk";

const commercePluginModule = definePluginModule({
  plugin: {
    id: "commerce",
    name: "Opays Commerce",
    capabilities: [addStockCapability],
    tools: new Map([["commerce.inventory.add", new AddInventoryTool()]]),
  },
});

const runtime = new OipRuntime().use(commercePluginModule);
```

## 5. Planifier et executer une action

```ts
import { MockLlmAdapter } from "@opaystech/oip/llm-adapter";

const planner = runtime.createPlanner(
  new MockLlmAdapter(() => ({
    capabilityId: "commerce.inventory.add",
    arguments: { itemName: "sacs de ciment", quantity: 20 },
    confidence: 0.95,
    reason: "L’utilisateur demande d’ajouter du stock.",
  })),
);

const plan = await planner.plan("Ajoute 20 sacs de ciment au stock");

const result = await runtime.execute(plan, {
  requestId: "req-001",
  channel: "web",
  user: {
    userId: "user-001",
    organizationId: "opays-demo",
    roles: ["inventory.manager"],
    locale: "fr-CD",
    activeModule: "commerce",
    activePage: "inventory",
  },
});

console.log(result.status); // "completed" ou "rejected"
```

## 6. Configuration LLM en production

```ts
import { loadLlmConfig, createLlmAdapter } from "@opaystech/oip/config";

const llm = createLlmAdapter(loadLlmConfig(process.env));
```

Variables d’environnement :

```bash
OIP_LLM_PROVIDER=openai-compatible
OIP_LLM_BASE_URL=https://api.openai.com/v1
OIP_LLM_API_KEY=sk-...
OIP_LLM_MODEL=gpt-4.1-mini
```

## 7. Adapter des services externes

OIP expose des interfaces a implementer pour brancher des services reels :

- `VectorAdapter` : moteur de recherche vectorielle (ex. ZVec).
- `DocumentAdapter` : extraction de texte depuis des fichiers binaires.
- `OcrAdapter` : OCR sur images/scans.
- `AutomationAdapter` : declenchement d’automations.
- `McpAdapter` : integration MCP.
- `AuditLogger`, `EventPublisher`, `MemoryStore` : persistance et audit.

Exemple :

```ts
const runtime = new OipRuntime({
  vector: new MyZvecAdapter(),
  documentParser: new MyDocumentAdapter(),
  ocr: new MyOcrAdapter(),
  memory: new MyPostgresMemoryStore(),
});
```

## 8. Exemple minimal complet

```ts
import { OipRuntime } from "@opaystech/oip";
import { defineCapability } from "@opaystech/oip/core";
import { definePluginModule } from "@opaystech/oip/plugin-sdk";

const addStock = defineCapability({
  id: "commerce.inventory.add",
  description: "Ajouter du stock.",
  parameters: [
    { name: "itemName", type: "string", required: true },
    { name: "quantity", type: "number", required: true },
  ],
  requiredRoles: ["inventory.manager"],
});

const plugin = definePluginModule({
  plugin: {
    id: "commerce",
    name: "Commerce Demo",
    capabilities: [addStock],
    tools: new Map([
      [
        "commerce.inventory.add",
        {
          execute: async (args) => ({
            capabilityId: "commerce.inventory.add",
            status: "completed" as const,
            data: args,
            events: [],
          }),
        },
      ],
    ]),
  },
});

const runtime = new OipRuntime().use(plugin);

const result = await runtime.execute(
  {
    capabilityId: "commerce.inventory.add",
    arguments: { itemName: "ciment", quantity: 10 },
    confidence: 1,
    reason: "Test.",
  },
  {
    requestId: "demo-001",
    channel: "web",
    user: {
      userId: "u-1",
      organizationId: "org-1",
      roles: ["inventory.manager"],
      locale: "fr-CD",
    },
  },
);

console.log(result.status);
```

## Ce qui reste interne

Ne pas dependre de :

- Chemins de fichiers internes (`packages/*/src/...`).
- Classes d’implementation memoire non exportees par les chemins publics.
- La facade `OipRuntimeBuilder` / `ComposedRuntime` tant qu’elles ne sont pas explicitement documentees comme stables.
- Le `ChatService`, l’API demo, les plugins exemples : ce sont des consommateurs de reference, pas des API supportees.

## Prochaines evolutions du SDK

- CLI `oip init` pour scaffold un plugin.
- Validation runtime des capabilities.
- Adaptateurs reference pour PostgreSQL, ZVec, observabilite.
- Documentation interactive des contrats.
- Exemples par secteur (Commerce, RH, etc.).
