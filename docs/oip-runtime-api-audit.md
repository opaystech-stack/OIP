# Audit de l'API publique actuelle d'OIP

Version : `1.0.0-draft`  
Statut : Document d'étude  
Date : 2026-07-09

---

## 1. Méthodologie

Cet audit couvre l'API publique exposée par le package unique `@opaystech/oip` à la version `0.1.0-alpha`. Il ne porte pas sur les implémentations internes, mais sur ce qu'un développeur externe peut effectivement importer, instancier et appeler.

Trois points d'entrée ont été inspectés :

- `packages/core/src/index.ts`
- `packages/runtime/src/index.ts`
- `packages/plugin-sdk/src/index.ts`

Ainsi que les démonstrations d'usage dans `examples/api-demo/src/server.ts`.

---

## 2. API publique JavaScript/TypeScript

### 2.1 Exports du package unique `@opaystech/oip`

Le package unique ré-exporte principalement depuis `packages/runtime/src/index.ts` :

| Symbole | Type | Usage public |
|---|---|---|
| `OipRuntime` | Classe | Point d'entrée principal |
| `OipRuntimeOptions` | Interface | Configuration du runtime |
| `createRuntimeFromEnv` | Fonction | Factory lecture/env |
| `defineCapability` | Helper | Déclarer une capability |
| `defineTool` | Helper | Déclarer un outil |
| `success`, `rejected` | Helpers | Résultats d'action |
| `definePlugin` | Helper | Déclarer un plugin |
| `definePluginModule` | Helper | Déclarer un module de plugin |
| `installPluginModule` | Fonction | Installer un module |
| `MockLlmAdapter`, `OpenAiCompatibleLlmAdapter` | Classes | Adaptateurs LLM |
| `ActionEngine`, `CapabilityRegistry`, `ToolRegistry`, `Validator` | Classes | Interne/expert |
| Types divers (`ActionResult`, `PlannedAction`, `RuntimeContext`, etc.) | Types | Typage |

### 2.2 Capacités publiques de `OipRuntime`

La classe `OipRuntime` expose les propriétés et méthodes suivantes :

| Membre | Type | Stable ? | Commentaire |
|---|---|---|---|
| `capabilities` | `CapabilityRegistry` | Non | API interne brute |
| `tools` | `ToolRegistry` | Non | API interne brute |
| `workflows` | `WorkflowRegistry` | Non | API interne brute |
| `knowledge` | `KnowledgeEngine` | Non | Dépend d'un moteur spécifique |
| `documentKnowledge` | `MutableKnowledgeSource` | Non | Interne |
| `documents` | `DocumentService` | Non | Service concret |
| `memory` | `MemoryStore` | Non | Type moteur |
| `observability` | `InMemoryObservabilityAdapter` | Non | Implémentation concrete |
| `automation` | `AutomationAdapter` | Partiel | Contrat abstrait |
| `mcp` | `McpAdapter` | Partiel | Contrat abstrait |
| `events` | `EventPublisher` + `list` optionnel | Non | API ad hoc |
| `audit` | `AuditLogger` + `list` optionnel | Non | API ad hoc |
| `actions` | `ActionEngine` | Non | Interne |
| `workflowEngine` | `WorkflowEngine` | Non | Interne |
| `contextBuilder` | `ContextRuntimeBuilderAdapter` | Non | Type interne |
| `use(module)` | Méthode | Oui | Installer un plugin |
| `createPlanner(llm)` | Méthode | Partiel | Crée un planner lié au runtime |
| `buildContext(input, context)` | Méthode | Partiel | Dépend du context builder |
| `execute(plan, context)` | Méthode | Partiel | Exécute une action planifiée |

### 2.3 Runtimes individuels (internes)

Les packages suivants existent mais ne sont pas ré-exportés par le package unique :

- `identity-runtime`
- `policy-runtime`
- `memory-runtime`
- `event-runtime`
- `context-runtime`
- `decision-runtime`
- `llm-runtime`
- `knowledge-runtime`

Ils possèdent chacun un contrat (`IdentityRuntime`, `PolicyRuntime`, etc.) défini dans `packages/core/src/contracts/index.ts`, mais ces contrats ne sont pas exposés publiquement via `@opaystech/oip`. Ils sont donc inaccessibles aux consommateurs externes sans import profond et non stable.

### 2.4 Exemple d'API HTTP (`examples/api-demo`)

L'API HTTP de démonstration expose les routes suivantes :

| Route | Méthode | Description | Limitation |
|---|---|---|---|
| `/health` | GET | Santé | OK |
| `/capabilities` | GET | Liste des capabilities | Lecture seule |
| `/chat` | POST | Chat complet (context → plan → action) | Mélange les responsabilités |
| `/actions` | POST | Exécution directe d'une action | Nécessite un plan déjà connu |
| `/documents` | POST | Ingestion de document | Lié à un service concret |
| `/admin/audit` | GET | Audit | Route d'administration |
| `/admin/traces` | GET | Traces | Route d'administration |
| `/admin/events` | GET | Événements | Route d'administration |

Cette API est un exemple, pas un contrat public. Elle n'est pas versionnée, pas authentifiée, et ne distingue pas les Runtimes.

### 2.5 Adaptateurs d'intégration

`packages/integration-adapters` expose :

- `AutomationAdapter`
- `McpAdapter`

Ce sont des interfaces abstraites sans implémentation publique stable.

### 2.6 Contrats internes vs publics

| Contrat | Localisation | Exposé publiquement ? |
|---|---|---|
| `Capability` | `core/src/contracts/capability.js` | Oui (types) |
| `PlannedAction` | `core/src/contracts/plan.js` | Oui |
| `ActionResult` | `core/src/action-result.js` | Oui |
| `RuntimeContext` | `core/src/types.js` | Oui |
| `LlmAdapter` | `llm-adapter/src/index.js` | Oui |
| `IdentityRuntime` | `core/src/contracts/identity.js` | Non |
| `PolicyRuntime` | `core/src/contracts/policy.js` | Non |
| `MemoryRuntime` | `core/src/contracts/memory.js` | Non |
| `EventRuntime` | `core/src/contracts/event.js` | Non |
| `KnowledgeRuntime` | `core/src/contracts/knowledge.js` | Non |
| `LlmRuntime` | `core/src/contracts/runtime.js` | Non |
| `ContextRuntime` | `core/src/contracts/context.js` | Non |

### 2.7 Synthèse des limitations

1. **Pas de façade publique par Runtime** : les Runtimes individuels existent mais ne sont pas accessibles via le package unique.
2. **Mélange des niveaux d'abstraction** : `OipRuntime` expose à la fois des registres bruts (`capabilities`, `tools`), des moteurs concrets (`knowledge`, `documents`) et des adaptateurs internes.
3. **Pas de contrat public stable** : la surface publique dépend de classes internes (`InMemoryObservabilityAdapter`, `InMemoryContextRuntime`, etc.).
4. **API HTTP non contractuelle** : l'exemple `api-demo` n'est pas une API publique officielle ; il n'y a pas de schéma, de versionnement ni de stabilité garantie.
5. **LLM non accessible directement** : l'unique point d'entrée LLM public passe par `createPlanner` ou `ChatService`, pas par un Runtime LLM autonome. Le `LlmRuntime` existe mais n'est pas exposé.
6. **Identity/Policy absents** : bien que définis dans les contrats, ils ne sont ni ré-exportés, ni branchés dans `OipRuntime`.
7. **Pas de séparation transport/métier** : toute consommation externe doit soit utiliser le runtime monolithique, soit importer des packages internes.

---

## 3. Conclusion

L'API publique actuelle d'OIP est centrée sur `OipRuntime` et `ChatService`. Elle permet de construire une application par composition de plugins, mais elle ne fournit pas de contrats publics stables par domaine (LLM, mémoire, événements, politique, identité, décision, contexte).

Cette absence bloque MB-001 car Opays-HQ ne peut pas consommer le LLM Runtime en Shadow Mode via une API publique claire, versionnée et indépendante des implémentations internes.

La suite de l'étude propose une architecture publique qui expose les Runtimes comme des services de premier plan, sans modifier les implémentations existantes.

---

## 4. Références

- `packages/runtime/src/index.ts`
- `packages/core/src/index.ts`
- `packages/core/src/contracts/index.ts`
- `packages/chat-service/src/index.ts`
- `examples/api-demo/src/server.ts`
- `docs/oip-public-contracts.md`
