# Migration Blueprint — OIP Engineering Roadmap

> Version: 1.0.0  
> Statut: Validé — phase d'ingénierie  
> Date: Juillet 2026  
> Objectif: transformer le moteur actuel en OIP sans rupture, par strangulation progressive.

---

## 1. Principes directeurs

1. **Strangulation progressive**, pas réécriture.
2. **Chaque commit laisse le projet compilable, testable et utilisable.**
3. **Aucun plugin existant (Commerce, RH) ne devient inutilisable sans équivalent.**
4. **Les contrats publics sont définis avant d'être consommés.**
5. **Un ancien composant est supprimé uniquement quand son remplaçant est stable et testé.**
6. **Chaque étape a des critères de fin objectifs.**
7. **La progression est mesurable et réversible.**

---

## 2. État de départ

### Codebase actuelle

- Monorepo TypeScript, zéro dépendance runtime.
- `npm run check && npm test` OK — 19 tests passent.
- `packages/core` contient `ActionEngine`, `CapabilityRegistry`, `Validator`, `planner.ts` avec `RuleBasedPlanner`.
- `packages/runtime/src/index.ts` est une facade fortement couplée : importe des implémentations concrètes (`InMemoryStore`, `InMemoryEventBus`, `InMemoryAuditLog`, `KnowledgeEngine`, `LlmPlanner`, `ContextBuilder`, `OpenAiCompatibleLlmAdapter`, etc.).
- `packages/config` importe directement `OpenAiCompatibleLlmAdapter`.
- `packages/planner` injecte la liste complète des capabilities dans le prompt LLM.
- Plugins Commerce et RH conservent leurs données en mémoire via des variables globales de module.
- `apps/api` expose une API HTTP avec un seul endpoint `/chat`.

### Dette technique identifiée

1. Couplage excessif dans `OipRuntime`.
2. `RuleBasedPlanner` dans `core`.
3. `LlmPlanner` injecte toutes les capabilities dans le prompt (risque de scalabilité contextuelle).
4. Manque de contrats publics entre Runtimes.
5. Manque d'Identity Runtime, de Policy Runtime, de Decision Runtime explicite.
6. Les plugins mélangent logique métier et registration.
7. `OipRuntimeOptions` est incomplet et mélange interfaces et implémentations.

---

## 3. Ordre des migrations

### Vue d'ensemble

```text
Étape 0 — Stabiliser la baseline
Étape 1 — Définir les contrats publics TypeScript
Étape 2 — Introduire le RuntimeBuilder injectable
Étape 3 — Refactorer OipRuntime pour consommer les contrats
Étape 4 — Introduire Decision Runtime
Étape 5 — Extraire RuleBasedPlanner du core
Étape 6 — Introduire Identity Runtime
Étape 7 — Introduire Policy Runtime (minimal)
Étape 8 — Introduire Event Runtime stable
Étape 9 — Introduire Memory Runtime et Context Runtime propres
Étape 10 — Migrer les plugins Commerce et RH au contrat Capability
Étape 11 — Migrer l'API HTTP vers le nouveau cycle de vie
Étape 12 — Nettoyer les dépendances concrètes du runtime
```

---

### Étape 0 — Stabiliser la baseline

**Objectif :** s'assurer que nous partons d'un état connu, propre et mesurable.

**Actions :**
- Committer ou annuler les modifications non commitées actuelles (`packages/runtime/src/index.ts` + `tests/oip-core.test.ts`).
- Vérifier `npm run check && npm test`.
- Geler la baseline avec un tag ou un commit explicite (`baseline-oip-v2`).
- Documenter l'état exact du repo dans `docs/oip-migration-baseline.md`.

**Pourquoi en premier :** sans baseline stable, impossible de mesurer les régressions.

**Dépendances supprimées :** aucune.

**Dépendances introduites :** aucune.

**Composants restants compatibles :** tous.

**Critères de fin :**
- [ ] `git status` propre.
- [ ] `npm run check && npm test` passe.
- [ ] Tag `baseline-oip-v2` créé.
- [ ] Document `docs/oip-migration-baseline.md` rédigé.

**Risques :** faible. Seul risque = perte des modifications non commitées si elles étaient importantes.

**Rollback :** `git reset --hard baseline-oip-v2`.

---

### Étape 1 — Définir les contrats publics TypeScript

**Objectif :** créer le langage commun de tous les Runtimes avant toute implémentation.

**Actions :**
- Créer `packages/core/src/contracts/`.
- Définir :
  - `capability.ts` — `Capability`, `CapabilityParameter`, `ConfirmationLevel`, `CapabilityErrorCode`.
  - `intention.ts` — `Intention`, `Entity`.
  - `plan.ts` — `ExecutionPlan`, `ExecutionStep`, `PlannedAction`, `DecisionResult`.
  - `action.ts` — `ActionResult`, `ActionError`.
  - `identity.ts` — `IdentityContext`, `Workspace`.
  - `context.ts` — `ExecutionContext`.
  - `event.ts` — `DomainEvent`.
  - `memory.ts` — `MemoryEntry`, `MemoryResult`, `MemoryQuery`.
  - `knowledge.ts` — `KnowledgeQuery`, `KnowledgeResult`, `KnowledgeSource`.
  - `channel.ts` — `InboundRequest`, `OutboundResponse`, `ChannelPayload`.
  - `policy.ts` — `PolicyDecision`, `PolicyRequest`.
  - `workflow.ts` — `WorkflowExecution`, `WorkflowSignal`, `WorkflowState`.
  - `skill.ts` — `SkillDefinition`, `SkillInput`, `SkillResult`.
- Exporter ces contrats depuis `packages/core/src/index.ts`.
- Écrire des tests de type-only qui vérifient que les interfaces peuvent être implémentées.

**Pourquoi en premier :** tous les Runtimes futurs dépendent de ces contrats. Les définir d'abord évite les refactorings en cascade.

**Dépendances supprimées :** aucune (seulement de la duplication implicite).

**Dépendances introduites :** `zod` ou `valibot` optionnel pour validation runtime des contrats (à décider ; si possible rester sans dépendance runtime).

**Composants restants compatibles :** tous. Les contrats sont ajoutés, pas substitués.

**Critères de fin :**
- [ ] Tous les contrats de `oip-runtimes-reference.md` et `oip-capability-contract.md` sont modélisés.
- [ ] `npm run check` passe.
- [ ] Tests de contrat passent.
- [ ] Aucune modification du comportement existant.

**Risques :** faible. Pure ajout de types.

**Rollback :** supprimer `packages/core/src/contracts/`.

---

### Étape 2 — Introduire le RuntimeBuilder injectable

**Objectif :** permettre de composer OIP par injection de dépendances, sans couplage concret.

**Actions :**
- Créer `packages/runtime/src/builder.ts`.
- Définir `OipRuntimeBuilder` qui accepte des interfaces :
  - `LlmRuntime`
  - `DecisionRuntime`
  - `ActionRuntime`
  - `MemoryRuntime`
  - `KnowledgeRuntime`
  - `EventRuntime`
  - `IdentityRuntime`
  - `PolicyRuntime`
  - `WorkflowRuntime`
  - `SkillRuntime`
  - `ObservabilityRuntime`
  - `ChannelRuntime`
- Créer `OipRuntimeBuilder.withDefaults()` qui utilise les implémentations actuelles en mémoire pour maintenir la compatibilité.
- Conserver `OipRuntime` existant pour ne pas casser l'API publique actuelle.

**Pourquoi après les contrats :** le builder a besoin des interfaces pour être typé.

**Dépendances supprimées :** aucune encore.

**Dépendances introduites :** aucune (builder purement TypeScript).

**Composants restants compatibles :** `OipRuntime` fonctionne exactement comme avant, mais peut désormais être construit par `OipRuntimeBuilder`.

**Critères de fin :**
- [ ] `OipRuntimeBuilder` compile.
- [ ] `OipRuntime` peut être instancié via `new OipRuntimeBuilder().withDefaults().build()`.
- [ ] `npm test` passe sans modification des tests existants.
- [ ] Nouveaux tests ajoutés pour vérifier l'injection d'un LLM mocké.

**Risques :** moyen. Touche à `packages/runtime`. Nécessite de conserver l'ancien constructeur.

**Rollback :** supprimer `builder.ts` et revenir à l'ancien constructeur.

---

### Étape 3 — Refactorer OipRuntime pour consommer les contrats

**Objectif :** `OipRuntime` ne dépend plus d'implémentations concrètes mais d'interfaces.

**Actions :**
- Remplacer les imports concrets dans `OipRuntime` par les interfaces des contrats.
- Déplacer les implémentations par défaut dans `packages/runtime/src/adapters/` ou `packages/*-runtime/src/adapters/`.
- Introduire `InMemoryLlmRuntime`, `InMemoryMemoryRuntime`, etc. comme implémentations par défaut.
- Conserver `InMemoryStore`, `InMemoryEventBus`, `InMemoryAuditLog` comme détails d'implémentation de leurs Runtimes respectifs.

**Pourquoi après le builder :** le builder fournit le mécanisme d'injection. Cette étape fournit les détails.

**Dépendances supprimées :** imports concrets dans `OipRuntime` (`KnowledgeEngine`, `LlmPlanner`, `ContextBuilder`, `ActionEngine`, `Validator`, etc.).

**Dépendances introduites :** packages `*-runtime` (ou leurs adapters) comme implémentations par défaut.

**Composants restants compatibles :** les tests existants continuent de passer via `withDefaults()`.

**Critères de fin :**
- [ ] `OipRuntime` n'importe aucune implémentation concrète de moteur.
- [ ] `npm run check` passe.
- [ ] `npm test` passe.
- [ ] Les options `automation` et `mcp` restent disponibles.

**Risques :** moyen/élevé. C'est le cœur de la migration. Nécessite des tests solides.

**Rollback :** revenir au commit précédent.

---

### Étape 4 — Introduire Decision Runtime

**Objectif :** créer un Runtime dédié à la traduction Intention → ExecutionPlan.

**Actions :**
- Créer `packages/decision-runtime/`.
- Définir l'interface `DecisionRuntime` dans `packages/core/src/contracts/decision.ts`.
- Implémenter `LlmBasedDecisionRuntime` qui encapsule la logique actuelle du planner.
- Implémenter `RuleBasedDecisionRuntime` comme fallback.
- Faire en sorte que `OipRuntime` utilise `DecisionRuntime` au lieu d'appeler directement `LlmPlanner`.

**Pourquoi après le refactor du runtime :** le Decision Runtime doit être injecté comme toute autre dépendance.

**Dépendances supprimées :** couplage direct avec `LlmPlanner`.

**Dépendances introduites :** `packages/decision-runtime`.

**Composants restants compatibles :** `LlmPlanner` peut être temporairement encapsulé dans `LlmBasedDecisionRuntime`.

**Critères de fin :**
- [ ] `DecisionRuntime` est injectable.
- [ ] Le flux Intention → Plan passe par `DecisionRuntime`.
- [ ] `RuleBasedPlanner` reste fonctionnel via `RuleBasedDecisionRuntime`.
- [ ] `npm test` passe.

**Risques :** moyen. Nécessite de ne pas changer le comportement de planification.

**Rollback :** revenir à l'appel direct de `LlmPlanner`.

---

### Étape 5 — Extraire RuleBasedPlanner du core

**Objectif :** retirer du `core` toute logique de planification.

**Actions :**
- Déplacer `RuleBasedPlanner` de `packages/core/src/planner.ts` vers `packages/decision-runtime/src/rule-based-decision-runtime.ts`.
- Supprimer `packages/core/src/planner.ts` (ou le vider).
- Mettre à jour `packages/core/src/index.ts`.
- S'assurer que `core` ne contient que des contrats et des utilities.

**Pourquoi après Decision Runtime :** le planner a besoin d'un nouveau foyer.

**Dépendances supprimées :** `RuleBasedPlanner` du core.

**Dépendances introduites :** aucune.

**Composants restants compatibles :** `RuleBasedDecisionRuntime` expose la même fonctionnalité.

**Critères de fin :**
- [ ] `packages/core/src/planner.ts` est supprimé.
- [ ] `npm test` passe.
- [ ] Aucun test ne dépend de `RuleBasedPlanner` dans le core.

**Risques :** faible. Simple déplacement.

**Rollback :** restaurer `planner.ts`.

---

### Étape 6 — Introduire Identity Runtime

**Objectif :** formaliser l'authentification et le scoping workspace.

**Actions :**
- Créer `packages/identity-runtime/`.
- Définir `IdentityRuntime` et `IdentityContext`, `Workspace` dans les contrats.
- Implémenter `InMemoryIdentityProvider` pour les tests.
- Intégrer `IdentityRuntime` dans `OipRuntime` via le builder.
- Dans un premier temps, Identity Runtime retourne une identité anonyme par défaut pour ne pas casser l'API `/chat`.

**Pourquoi à ce stade :** le Context Runtime et le Policy Runtime en ont besoin.

**Dépendances supprimées :** aucune.

**Dépendances introduites :** `packages/identity-runtime`.

**Composants restants compatibles :** API `/chat` continue de fonctionner avec identité anonyme.

**Critères de fin :**
- [ ] `IdentityRuntime` injectable.
- [ ] `InMemoryIdentityProvider` fonctionne.
- [ ] `npm test` passe.

**Risques :** faible. Pure ajout.

**Rollback :** supprimer `packages/identity-runtime` et utiliser une identité anonyme inline.

---

### Étape 7 — Introduire Policy Runtime (minimal)

**Objectif :** poser la base de la gouvernance sans bloquer les flux.

**Actions :**
- Créer `packages/policy-runtime/`.
- Définir `PolicyRuntime` dans les contrats.
- Implémenter `DeclarativePolicyRuntime` (règles JSON/YAML simples).
- Par défaut, toutes les actions sont autorisées (pas de rupture).
- Intégrer `PolicyRuntime` dans `ActionRuntime`.

**Pourquoi à ce stade :** Action Runtime a besoin d'un point de validation gouvernance.

**Dépendances supprimées :** vérification manuelle des permissions dans `ActionEngine` (si existante).

**Dépendances introduites :** `packages/policy-runtime`.

**Composants restants compatibles :** comportement par défaut permissif.

**Critères de fin :**
- [ ] `PolicyRuntime` injectable.
- [ ] Par défaut, les actions passent.
- [ ] `npm test` passe.

**Risques :** faible. Mode permissif par défaut.

**Rollback :** revenir à une vérification vide.

---

### Étape 8 — Introduire Event Runtime stable

**Objectif :** remplacer le bus d'événements ad-hoc par un `EventRuntime` conforme au contrat.

**Actions :**
- Créer `packages/event-runtime/`.
- Définir `EventRuntime` dans les contrats.
- Implémenter `InMemoryEventRuntime` (wrappant `InMemoryEventBus` actuel).
- Implémenter `SqliteEventRuntime` ou `JsonFileEventRuntime` si besoin.
- Faire en sorte que `ActionRuntime` publie systématiquement les événements via `EventRuntime`.

**Pourquoi à ce stade :** Event Runtime est le système nerveux et facilite les interactions transverses.

**Dépendances supprimées :** couplage direct avec `InMemoryEventBus` dans `ActionRuntime`.

**Dépendances introduites :** `packages/event-runtime`.

**Composants restants compatibles :** `InMemoryEventBus` devient l'implémentation interne de `InMemoryEventRuntime`.

**Critères de fin :**
- [ ] `EventRuntime` injectable.
- [ ] Toute action exécutée publie un événement.
- [ ] `npm test` passe.

**Risques :** moyen. Nécessite de ne pas perdre d'événements dans les tests.

**Rollback :** revenir à `InMemoryEventBus` directement.

---

### Étape 9 — Introduire Memory Runtime et Context Runtime propres

**Objectif :** centraliser la mémoire et l'assemblage du contexte.

**Actions :**
- Créer `packages/memory-runtime/` et `packages/context-runtime/`.
- Définir `MemoryRuntime` et `ContextRuntime` dans les contrats.
- Déplacer `InMemoryStore` dans `packages/memory-runtime/src/adapters/`.
- Déplacer `ContextBuilder` dans `packages/context-runtime/src/`.
- Faire en sorte que `OipRuntime` utilise `ContextRuntime` pour construire le contexte.

**Pourquoi à ce stade :** ces Runtimes sont nécessaires pour un cycle de vie complet.

**Dépendances supprimées :** `ContextBuilder` directement dans `OipRuntime`.

**Dépendances introduites :** `packages/memory-runtime`, `packages/context-runtime`.

**Composants restants compatibles :** comportement identique.

**Critères de fin :**
- [ ] `MemoryRuntime` et `ContextRuntime` injectables.
- [ ] `OipRuntime` ne construit plus le contexte lui-même.
- [ ] `npm test` passe.

**Risques :** moyen. Touche au flux de contexte.

**Rollback :** revenir à `ContextBuilder` inline.

---

### Étape 10 — Migrer les plugins Commerce et RH au contrat Capability

**Objectif :** les plugins déclarent des capabilities conformes au contrat et exposent des ToolHandlers.

**Actions :**
- Créer un helper `defineCapability(capability, handler)` dans `plugin-sdk`.
- Refactorer `plugins/commerce/src/index.ts` pour déclarer des capabilities (`commerce.inventory.add`, `commerce.sales.create`, etc.).
- Refactorer `plugins/hr/src/index.ts` de la même manière.
- Conserver la logique métier inchangée.
- Ajouter des tests unitaires par capability.

**Pourquoi tardivement :** les plugins dépendent de tous les contrats et du builder.

**Dépendances supprimées :** registration manuelle des capabilities.

**Dépendances introduites :** `defineCapability` helper.

**Composants restants compatibles :** les capabilities existantes restent enregistrées via le nouveau helper.

**Critères de fin :**
- [ ] Toutes les actions métier de Commerce et RH sont des capabilities.
- [ ] Chaque capability a un ToolHandler testé.
- [ ] `npm test` passe.
- [ ] L'exemple `examples/commerce-demo.ts` fonctionne.

**Risques :** moyen/élevé. Touche au métier. Nécessite des tests métier.

**Rollback :** revenir aux anciens modules plugins.

---

### Étape 11 — Migrer l'API HTTP vers le nouveau cycle de vie

**Objectif :** l'API HTTP reflète le cycle de vie complet : Channel → Identity → Context → Decision → Action → Response.

**Actions :**
- Refactorer `apps/api/src/server.ts` pour utiliser `ChannelRuntime`, `IdentityRuntime`, `ContextRuntime`, `DecisionRuntime`, `ActionRuntime`, `SkillRuntime`.
- Conserver l'endpoint `/chat` comme API web, mais le canaliser correctement.
- Ajouter un endpoint `/capabilities` pour lister les capabilities d'un workspace.
- Ajouter un endpoint `/request/:id` pour consulter l'état d'une requête.

**Pourquoi en dernier :** l'API dépend de tous les Runtimes.

**Dépendances supprimées :** appels directs à `OipRuntime` depuis l'API.

**Dépendances introduites :** utilisation explicite des Runtimes.

**Composants restants compatibles :** endpoint `/chat` continue de fonctionner.

**Critères de fin :**
- [ ] L'API compile et démarre.
- [ ] Les tests existants passent.
- [ ] `/chat` retourne toujours une réponse.

**Risques :** moyen. Touche à l'interface externe.

**Rollback :** revenir à `server.ts` précédent.

---

### Étape 12 — Nettoyer les dépendances concrètes du runtime

**Objectif :** supprimer les imports d'implémentations concrètes restants.

**Actions :**
- Vérifier qu'aucun package `*-runtime` n'importe d'implémentation concrète d'un autre Runtime.
- Déplacer les adapters spécifiques dans `packages/adapters/`.
- Supprimer `packages/config/src/index.ts` si inutile ou le transformer en configuration pure.
- Vérifier que `packages/core` ne contient que des contrats.

**Pourquoi en dernier :** c'est le nettoyage final.

**Dépendances supprimées :** imports concrètes résiduels.

**Dépendances introduites :** aucune.

**Composants restants compatibles :** tous.

**Critères de fin :**
- [ ] `npm run check` sans erreur d'import.
- [ ] `npm test` passe.
- [ ] Aucune logique métier dans `packages/core`.

**Risques :** faible.

**Rollback :** revenir au commit précédent.

---

## 4. Stratégie de compatibilité (strangulation progressive)

### Principe

L'ancien `OipRuntime` reste fonctionnel pendant toute la migration. Les nouveaux Runtimes sont introduits parallèlement et branchés progressivement via `OipRuntimeBuilder`.

### Mécanisme

1. **Facade stable :** `OipRuntime` conserve sa surface d'API publique actuelle (`capabilities`, `actions`, `workflows`, `chat`, `execute`, etc.).
2. **Builder parallèle :** `OipRuntimeBuilder` construit progressivement une nouvelle implémentation interne.
3. **Adapters de compatibilité :** les anciens composants (`InMemoryStore`, `InMemoryEventBus`, `LlmPlanner`, `ContextBuilder`) sont wrappés en implémentations des nouveaux contrats.
4. **Feature flags implicites :** tant qu'un Runtime n'est pas injecté via le builder, l'ancien comportement reste actif.

### Exemple

```ts
// Ancien code (compatible)
const runtime = new OipRuntime({ llm: mockLlm });

// Nouveau code (même résultat)
const runtime = new OipRuntimeBuilder()
  .withDefaults()
  .withLlmRuntime(mockLlm)
  .build();
```

### Composants anciens et date de retrait

| Ancien composant | Remplaçant | Moment de suppression |
|---|---|---|
| `packages/core/src/planner.ts` | `RuleBasedDecisionRuntime` | Étape 5 |
| `InMemoryEventBus` direct | `InMemoryEventRuntime` | Étape 8 |
| `ContextBuilder` direct | `ContextRuntime` | Étape 9 |
| `InMemoryStore` direct | `MemoryRuntime` | Étape 9 |
| `LlmPlanner` direct | `LlmBasedDecisionRuntime` | Étape 4 |
| Imports concrets dans `OipRuntime` | Interfaces + Builder | Étape 3 puis 12 |
| Plugins registration manuelle | `defineCapability` | Étape 10 |
| `apps/api` simple | API basée sur les Runtimes | Étape 11 |

### Garanties

- A chaque étape, `npm run check && npm test` doit passer.
- Les plugins existants continuent de s'enregistrer.
- L'API `/chat` continue de répondre.
- Aucun contrat public n'est cassé sans versionnage.

---

## 5. Gestion des risques par étape

### Étape 0 — Baseline

| Type | Risque | Mitigation |
|---|---|---|
| Technique | Perte des modifications non commitées | Reviewer `git diff` avant commit/tag |
| Fonctionnel | Aucun | — |
| Tests | Aucun | — |
| Rollback | `git reset --hard baseline-oip-v2` | Tag clair |

### Étape 1 — Contrats

| Type | Risque | Mitigation |
|---|---|---|
| Technique | Modélisation incomplète | Itérer avec les besoins des Runtimes |
| Fonctionnel | Aucun | types uniquement |
| Tests | Tests de contrat absents | Écrire des tests type-only |
| Rollback | Supprimer `packages/core/src/contracts/` | Pas d'impact runtime |

### Étape 2 — Builder

| Type | Risque | Mitigation |
|---|---|---|
| Technique | API builder instable | Garder `withDefaults()` |
| Fonctionnel | Aucun | builder parallèle |
| Tests | Régression sur `OipRuntime` | Tests existants conservés |
| Rollback | Supprimer `builder.ts` | Facile |

### Étape 3 — Refactor OipRuntime

| Type | Risque | Mitigation |
|---|---|---|
| Technique | Régression importante | Tests exhaustifs avant |
| Fonctionnel | API `/chat` cassée | Conserver `OipRuntime` public |
| Tests | Tests à adapter | Garder tests existants, ajouter tests de builder |
| Rollback | Revenir au commit précédent | Commit atomique |

### Étape 4 — Decision Runtime

| Type | Risque | Mitigation |
|---|---|---|
| Technique | Changement de planification | Encapsuler `LlmPlanner` |
| Fonctionnel | Réponses différentes | Comparer sorties avant/après |
| Tests | Tests de planification à ajuster | Conserver `RuleBasedDecisionRuntime` |
| Rollback | Réappeler `LlmPlanner` directement | Commit atomique |

### Étape 5 — Extraire RuleBasedPlanner

| Type | Risque | Mitigation |
|---|---|---|
| Technique | Import cassés | Mise à jour des exports |
| Fonctionnel | Aucun | simple déplacement |
| Tests | Tests qui pointaient sur `core/planner` | Mettre à jour les imports |
| Rollback | Restaurer le fichier | Facile |

### Étape 6 à 9 — Runtimes infrastructure

| Type | Risque | Mitigation |
|---|---|---|
| Technique | Nouveau package mal intégré | Tests par package |
| Fonctionnel | Aucun | comportements par défaut compatibles |
| Tests | Nouveaux tests à écrire | Un par Runtime |
| Rollback | Supprimer le package | Facile si isolé |

### Étape 10 — Plugins

| Type | Risque | Mitigation |
|---|---|---|
| Technique | Refactor métier | Tests métier existants |
| Fonctionnel | Régression fonctionnelle | Exemple `commerce-demo.ts` |
| Tests | Tests à enrichir | Tests par capability |
| Rollback | Restaurer les anciens modules | Commit atomique |

### Étape 11 — API HTTP

| Type | Risque | Mitigation |
|---|---|---|
| Technique | Endpoint cassé | Tests HTTP |
| Fonctionnel | Interface externe modifiée | Conserver `/chat` |
| Tests | Tests E2E à ajouter | Requêtes réelles |
| Rollback | Restaurer `server.ts` | Commit atomique |

### Étape 12 — Nettoyage

| Type | Risque | Mitigation |
|---|---|---|
| Technique | Import oublié | `npm run check` |
| Fonctionnel | Aucun | nettoyage |
| Tests | Aucun | — |
| Rollback | Commit précédent | Facile |

---

## 6. Premier Sprint d'ingénierie

### Objectif du Sprint

Poser les fondations sans rupture : **stabiliser la baseline, définir les contrats publics TypeScript et introduire le RuntimeBuilder injectable.**

### Durée suggérée

1 à 2 semaines, selon disponibilité.

### Livrables du Sprint

1. **Baseline taggée** : `baseline-oip-v2`.
2. **Contrats publics TypeScript** dans `packages/core/src/contracts/`.
3. **RuntimeBuilder** dans `packages/runtime/src/builder.ts`.
4. **Tests de contrat** pour chaque Runtime critique.
5. **Aucune rupture** : `npm run check && npm test` passe à la fin du Sprint.

### Tâches décomposées

| # | Tâche | Responsable | Critère de fin |
|---|---|---|---|
| 0.1 | Nettoyer `git status` et taguer `baseline-oip-v2` | Architecte | `git status` propre + tag |
| 0.2 | Documenter la baseline | Architecte | `docs/oip-migration-baseline.md` |
| 1.1 | Créer `packages/core/src/contracts/` et modéliser les contrats fondamentaux | Architecte | interfaces définies |
| 1.2 | Modéliser `Capability`, `Intention`, `ExecutionPlan`, `PlannedAction`, `ActionResult` | Architecte | tests de type passent |
| 1.3 | Modéliser `IdentityContext`, `Workspace`, `ExecutionContext` | Architecte | tests de type passent |
| 1.4 | Modéliser `DomainEvent`, `MemoryEntry`, `KnowledgeQuery`, `PolicyDecision` | Architecte | tests de type passent |
| 1.5 | Exporter les contrats depuis `packages/core/src/index.ts` | Architecte | `npm run check` |
| 2.1 | Créer `OipRuntimeBuilder` | Architecte | compile |
| 2.2 | Implémenter `withDefaults()` | Architecte | `OipRuntime` fonctionne via builder |
| 2.3 | Tests du builder avec LLM mocké | Architecte | tests passent |
| 2.4 | Valider compatibilité avec `new OipRuntime()` | Architecte | tests existants passent |

### Critères de validation du Sprint

- [ ] `git status` propre.
- [ ] Tag `baseline-oip-v2` créé.
- [ ] `packages/core/src/contracts/` contient tous les contrats fondamentaux.
- [ ] `OipRuntimeBuilder` compile et permet l'injection.
- [ ] `new OipRuntime()` et `new OipRuntimeBuilder().withDefaults().build()` produisent le même comportement.
- [ ] `npm run check && npm test` passe.
- [ ] Aucun plugin existant cassé.
- [ ] Aucune modification de l'API `/chat`.

### Risques du Sprint

| Risque | Mitigation |
|---|---|
| Modélisation trop abstraite | Confronter aux implémentations actuelles (`LlmPlanner`, `ActionEngine`, `InMemoryStore`) |
| API builder mal pensée | Garder `withDefaults()` et ne pas toucher à `OipRuntime` existant |
| Tests insuffisants | Écrire des tests de contrat type-only + tests comportementaux |

### Definition of Done du Sprint

> Le projet compile, tous les tests passent, les contrats publics sont modélisés, le builder est injectable, et l'ancien `OipRuntime` continue de fonctionner exactement comme avant.

---

## 7. Calendrier indicatif

| Sprint | Étape(s) | Focus | Durée estimée |
|---|---|---|---|
| 1 | 0, 1, 2 | Baseline, contrats, builder | 1-2 semaines |
| 2 | 3, 4, 5 | Refactor runtime, Decision Runtime, extraire planner | 1-2 semaines |
| 3 | 6, 7, 8, 9 | Identity, Policy, Event, Memory, Context Runtimes | 2-3 semaines |
| 4 | 10 | Migration plugins Commerce et RH | 1-2 semaines |
| 5 | 11, 12 | API HTTP et nettoyage final | 1-2 semaine |

**Total estimé :** 6 à 10 semaines pour une migration complète et stable, selon rythme.

---

## 8. Métriques de suivi

- **Couverture de tests** : ne doit pas baisser.
- **Nombre d'imports concrets dans `packages/runtime/src/index.ts`** : doit diminuer à chaque étape.
- **Nombre de packages `*-runtime` autonomes** : augmente à chaque étape.
- **Temps d'exécution des tests** : stable.
- **Nombre de capabilities déclarées via `defineCapability`** : augmente.
- **Nombre de références à `RuleBasedPlanner` dans `core`** : doit atteindre 0.

---

> Document de migration. Aucune modification du code source n'a été effectuée pour sa production.
