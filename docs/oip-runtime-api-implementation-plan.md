# Plan d'implémentation future de l'API publique des Runtime OIP

Version : `1.0.0-draft`  
Statut : Planification — non implémenté  
Date : 2026-07-09

---

## 1. Objectif

Ce document décrit les étapes futures de mise en œuvre de la facade publique des Runtime OIP, sans modifier les Runtimes existants. Il reste au niveau architectural et ne contient pas de code.

---

## 2. Prérequis

Avant toute implémentation :

- Valider l'ADR-009.
- S'assurer que les contrats internes (`IdentityRuntime`, `PolicyRuntime`, etc.) sont suffisamment stables.
- Disposer d'une Validation Suite capable de tester la facade par opération.
- Avoir validé le Manifest v1 d'Opays-HQ (déjà fait).
- Avoir validé le Migration Backlog d'Opays-HQ (déjà fait).

---

## 3. Phases d'implémentation

### Phase 1 — Définir le contrat public (`packages/public-api`)

Créer un package dédié qui contient uniquement :

- `OipPublicRequest`
- `OipPublicResponse`
- `OipPublicError`
- `OipPublicRuntimeApi` (interface abstraite)
- `OipOperationDefinition`
- Catalogue des opérations publiques

**Contrainte :** aucune dépendance vers les implémentations internes.

**Durée estimée :** courte.

### Phase 2 — Implémenter le routeur interne (`packages/public-api-router`)

Ce package implémente `OipPublicRuntimeApi` en recevant une instance `OipRuntime`. Il route chaque opération vers le bon composant interne :

| Opération | Composant interne appelé |
|---|---|
| `llm.generateText` | `LlmAdapterRuntime` |
| `llm.generateJson` | `LlmAdapterRuntime` |
| `llm.embed` | `LlmAdapterRuntime` |
| `memory.append` | `MemoryRuntime` |
| `memory.recall` | `MemoryRuntime` |
| `events.publish` | `EventRuntime` |
| `events.subscribe` | `EventRuntime` |
| `context.build` | `ContextRuntime` |
| `decision.plan` | `DecisionRuntime` |
| `decision.decide` | `DecisionRuntime` |
| `actions.execute` | `ActionEngine` |
| `knowledge.search` | `KnowledgeEngine` |
| `knowledge.ingest` | `DocumentService` / `KnowledgeEngine` |
| `identity.authenticate` | `IdentityRuntime` |
| `identity.resolveWorkspace` | `IdentityRuntime` |
| `policy.evaluate` | `PolicyRuntime` |
| `capabilities.list` | `CapabilityRegistry` |
| `audit.list` | `AuditLogger` |
| `traces.list` | `ObservabilityAdapter` |

**Contrainte :** le routeur ne modifie pas les Runtimes. Il adapte.

**Durée estimée :** moyenne.

### Phase 3 — SDK public (`packages/public-api` ou SDK séparé)

Fournir une implémentation locale de `OipPublicRuntimeApi` qui appelle directement le routeur quand l'application et OIP cohabitent dans le même processus.

```text
import { OipPublicClient } from "@opaystech/oip";
```

Cela permettra à Opays-HQ de tester la facade en mémoire avant même d'ajouter un serveur HTTP.

### Phase 4 — API HTTP unique (`packages/api` ou `apps/api` futur)

Implémenter un serveur HTTP minimal :

```text
POST /v1/oip/invoke
```

Le serveur :

- authentifie la requête via `IdentityRuntime` ;
- construit le `RuntimeContext` ;
- appelle la facade ;
- retourne la réponse `OipPublicResponse`.

C'est ce qui débloquera MB-001 pour Opays-HQ.

### Phase 5 — Validation et Shadow Mode

Ajouter dans la Validation Suite des scénarios qui appellent la facade par opération :

- `llm.generateText` retourne du texte.
- `actions.execute` respecte les rôles.
- `memory.recall` restitue une entrée.
- `policy.evaluate` refuse une action non autorisée.

Puis, dans le Shadow Mode d'Opays-HQ, appeler `llm.generateText` en parallèle du moteur legacy et comparer.

### Phase 6 — Expositions optionnelles

Si nécessaire, générer :

- des endpoints REST par Runtime (option A) à partir du catalogue d'opérations ;
- un serveur MCP ;
- des bindings CLI (`oip invoke llm.generateText ...`).

Ces expositions dérivent toutes du même contrat public.

---

## 4. Livrables par phase

| Phase | Livrable |
|---|---|
| 1 | `packages/public-api` avec contrats abstraits |
| 2 | `packages/public-api-router` implémentant `OipPublicRuntimeApi` |
| 3 | `OipPublicClient` dans le SDK |
| 4 | Serveur HTTP `POST /v1/oip/invoke` |
| 5 | Scénarios de Validation Suite + Shadow Mode |
| 6 | Expositions MCP/REST/CLI optionnelles |

---

## 5. Dépendances

| Phase | Dépend de |
|---|---|
| 1 | Aucune implémentation |
| 2 | Phase 1 + Runtimes existants |
| 3 | Phase 2 |
| 4 | Phase 2 + Identity/Auth |
| 5 | Phase 3 ou 4 + Validation Suite |
| 6 | Phase 4 + contrat stable |

---

## 6. Critères de démarrage d'une phase

- Phase 2 : ADR-009 accepté.
- Phase 3 : routeur opérationnel pour au moins LLM + Action + Memory.
- Phase 4 : SDK validé par un test consommateur.
- Phase 5 : API HTTP opérationnelle et tests passants.
- Phase 6 : première application pilote en Shadow Mode.

---

## 7. Références

- `docs/oip-runtime-api-contract.md`
- `docs/adr/adr-009-runtime-public-api.md`
- `docs/oip-roadmap-discovery-generator.md`
- `validation-suite/src/scenarios.ts`
- MB-001
