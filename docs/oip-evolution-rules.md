# Opays Intelligence Platform — Règles d'évolution

> Version: 1.0.0  > Statut: Validé — socle architectural  
> Date: Juillet 2026

Ce document formalise les règles immuables qui garantissent la cohérence, la maintenabilité et l'évolutivité d'OIP sur les dix prochaines années. Toute contribution au projet doit respecter ces règles. Toute exception doit être documentée dans un ADR et validée.

---

## 1. Règles fondamentales d'architecture

### Règle 1.1 — Un Runtime ne dépend jamais d'une implémentation concrète

**Énoncé :** chaque Runtime expose et consomme des interfaces (contrats publics). Il ignore l'implémentation interne des autres Runtimes.

**Exemples conformes :**
- `DecisionRuntime` dépend de `LlmRuntime`, pas de `OpenAiCompatibleLlmAdapter`.
- `WorkflowRuntime` dépend de `ActionRuntime`, pas de `LangGraphWorkflowAdapter`.

**Conséquence en cas de violation :** refactor obligatoire avant merge.

---

### Règle 1.2 — Un Adapter peut être remplacé sans modifier le moteur

**Énoncé :** tout changement de technologie externe (LLM, vector store, workflow engine, OCR, observabilité, etc.) doit être localisé dans l'Adapter concerné.

**Exemples :**
- Remplacer LangGraph par Temporal ne touche pas `packages/workflow-runtime/src/`.
- Remplacer ZVec par pgvector ne touche pas `packages/knowledge-runtime/src/`.

**Test de conformité :** changer d'Adapter doit faire passer exactement les mêmes tests de contrat.

---

### Règle 1.3 — Aucune logique métier dans le core

**Énoncé :** le core OIP et les Runtimes ne contiennent jamais de logique spécifique à un domaine. Le métier vit exclusivement dans les plugins.

**Exemples interdits :**
- Calculer un total de facture dans `ActionRuntime`.
- Gérer un stock dans `DecisionRuntime`.
- Connaître les règles de paie dans `PolicyRuntime`.

**Exception :** les règles de gouvernance génériques (RBAC, confirmation) ne sont pas du métier.

---

### Règle 1.4 — Le LLM n'exprime que des intentions

**Énoncé :** le LLM Runtime produit une `Intention`. Il ne retourne jamais un `capabilityId`, un nom de fonction ou un appel d'outil.

**Contrôle :** les prompts ne doivent pas contenir de liste de capabilities.

---

### Règle 1.5 — Decision Runtime est le seul planificateur

**Énoncé :** toute traduction d'intention en plan d'exécution passe par `DecisionRuntime`. Aucun autre Runtime ne construit d'`ExecutionPlan`.

**Conséquence :** `RuleBasedPlanner` actuel dans `core` doit migrer vers `DecisionRuntime` ou un Adapter.

---

## 2. Règles des Capabilities

### Règle 2.1 — Une Capability appartient à un seul plugin

**Énoncé :** une `Capability.id` est définie dans un et un seul plugin. Deux plugins ne peuvent pas déclarer la même capability.

**Namespace :** `pluginId.domain.action`.

---

### Règle 2.2 — Une Capability ne communique jamais directement avec une autre Capability

**Énoncé :** une capability n'appelle pas directement une autre capability. Les interactions transverses passent par Event Runtime.

**Exemple conforme :** `commerce.sales.create` émet `InvoiceRequested` ; un subscriber déclenche `commerce.invoice.create`.

**Exemple interdit :** `commerce.sales.create` appelle directement `commerce.invoice.create`.

---

### Règle 2.3 — Une Capability expose un contrat stable versionné

**Énoncé :** toute capability expose : id, version, description, paramètres, permissions, confirmation, résultat, événements, erreurs.

**Évolution :** modifier une capability existante implique soit un nouveau `version`, soit un nouvel `id`.

---

### Règle 2.4 — Une Capability est indépendante du canal

**Énoncé :** une capability ne sait pas si l'utilisateur vient du web, WhatsApp, API ou voix. Elle reçoit des arguments et un `ExecutionContext`.

---

### Règle 2.5 — Une Capability produit toujours des événements en cas de succès

**Énoncé :** si une capability modifie l'état du système, elle doit émettre au moins un `DomainEvent`.

**Exception :** les capabilities de lecture pure (`search`, `get`) n'émettent pas d'événement.

---

## 3. Règles des Runtimes

### Règle 3.1 — Chaque Runtime a une responsabilité unique

**Énoncé :** un Runtime ne fait pas le travail d'un autre Runtime. Les frontières sont dans `docs/oip-runtime-boundaries.md`.

**Conséquence :** tout court-circuit est interdit.

---

### Règle 3.2 — Action Runtime est le seul exécutant de capabilities

**Énoncé :** seul `ActionRuntime` peut appeler un `ToolHandler` de plugin. Workflow Runtime, Skill Runtime et MCP Runtime passent par `ActionRuntime`.

---

### Règle 3.3 — Workflow Runtime est une abstraction

**Énoncé :** `WorkflowRuntime` ne dépend jamais conceptuellement d'une technologie. LangGraph, Temporal, n8n sont des implémentations.

---

### Règle 3.4 — Knowledge Runtime est en lecture seule

**Énoncé :** `KnowledgeRuntime` indexe et recherche. Il ne modifie jamais les données des sources métier.

---

### Règle 3.5 — Memory Runtime centralise toutes les mémoires

**Énoncé :** aucun autre Runtime ne stocke d'historique. Toute mémoire passe par `MemoryRuntime`.

---

### Règle 3.6 — Event Runtime est le seul bus système

**Énoncé :** toute communication asynchrone entre plugins, Runtimes ou systèmes externes passe par `EventRuntime`.

---

## 4. Règles des plugins

### Règle 4.1 — Les plugins ne communiquent jamais directement entre eux

**Énoncé :** un plugin n'importe jamais un autre plugin. Les interactions transverses passent par Event Runtime.

**Exemple conforme :**
```text
Plugin A émet un événement → Event Runtime → Plugin B s'abonne
```

**Exemple interdit :**
```ts
import { commerceApi } from "../plugins/commerce";
```

---

### Règle 4.2 — Un plugin déclare tout via le SDK

**Énoncé :** capabilities, skills, knowledge sources, workflows, policies, connecteurs et événements doivent être déclarés via `plugin-sdk`.

**Interdit :** enregistrer une capability directement dans un Runtime depuis un plugin.

---

### Règle 4.3 — Un plugin ne connaît pas le canal

**Énoncé :** un plugin reçoit un `ExecutionContext`. Il ignore si l'utilisateur est sur WhatsApp ou mobile.

---

## 5. Règles d'évolution du core

### Règle 5.1 — Toute nouvelle fonctionnalité doit être évaluée avant d'être intégrée au Core

**Énoncé :** avant d'ajouter quoi que ce soit au core (`packages/core`), on vérifie si cela peut être :
1. Un Adapter.
2. Un Plugin.
3. Un Skill.
4. Un Runtime autonome (exceptionnel, avec ADR).
5. Une extension d'un Runtime existant.

**Seulement en dernier recours :** modification du core.

---

### Règle 5.2 — Les contrats publics sont versionnés

**Énoncé :** toute modification d'une interface publique entre Runtimes entraîne un changement de version. La rétrocompatibilité est privilégiée.

**Format :** `interface Capability { ... }` devient `CapabilityV1`, `CapabilityV2`, etc. en cas de rupture.

---

### Règle 5.3 — Les Runtimes s'évoluent par adjonction

**Énoncé :** on ajoute des Runtimes, des Adapters, des Plugins et des Skills. On ne réécrit pas le core pour chaque nouvelle fonctionnalité.

---

### Règle 5.4 — Aucun Runtime ne connaît SQLite, PostgreSQL, React, Expo

**Énoncé :** le moteur ne parle qu'à des Services et des Adapters. Les technologies de persistance et de présentation sont remplaçables.

---

## 6. Règles de qualité et de gouvernance du code

### Règle 6.1 — Tout contrat public est testé

**Énoncé :** chaque interface de Runtime doit avoir des tests de contrat. Chaque Adapter doit passer ces tests.

**Exemple :** `LlmRuntime` a un test contractuel qui valide `generateText`, `generateJson`, `embed`. Tout adapter LLM doit le passer.

---

### Règle 6.2 — Aucune modification du core sans review architecturale

**Énoncé :** toute PR touchant `packages/core`, `packages/*-runtime` ou les contrats publics doit être validée par l'architecte.

---

### Règle 6.3 — Les règles métier sensibles sont centralisées dans Policy Runtime

**Énoncé :** RBAC, ABAC, conformité, consentement, règles de confirmation et règles métier critiques vivent dans `PolicyRuntime` ou sont évaluées par lui.

---

### Règle 6.4 — L'observabilité est transversale

**Énoncé :** tout Runtime critique est tracé par `ObservabilityRuntime`. Aucun Runtime n'implémente son propre logger isolé.

---

## 7. Règles de priorisation

### Règle 7.1 — Simplicité avant généralisation

**Énoncé :** on résout d'abord un besoin concret avec une solution simple. On généralise seulement quand le pattern est confirmé par au moins deux usages réels.

**Anti-pattern :** créer une abstraction pour un cas d'usage hypothétique.

---

### Règle 7.2 — Pas de nouvelle couche sans justification

**Énoncé :** aucun nouveau Runtime, Adapter, Skill ou concept majeur ne peut être introduit sans ADR et sans besoin concret rencontré pendant l'implémentation.

---

### Règle 7.3 — La valeur plateforme prime sur le produit

**Énoncé :** si une fonctionnalité peut être réutilisée par plusieurs produits, elle doit être conçue comme un composant d'OIP, pas comme une implémentation spécifique à un plugin.

**Exception :** si la fonctionnalité est strictement propre à un métier, elle reste dans le plugin.

---

## 8. Matrice de décision d'ajout

| Je veux ajouter... | Où le placer | Exigence |
|---|---|---|
| Un nouveau fournisseur LLM | Adapter LLM | Passe les tests de contrat `LlmRuntime` |
| Un nouveau moteur de workflow | Adapter Workflow | Passe les tests de contrat `WorkflowRuntime` |
| Une action métier | Capability dans un Plugin | Respecte `oip-capability-contract.md` |
| Une aide UI | Skill (UI) | Ne touche pas au métier |
| Une règle de sécurité | Policy Runtime | Évaluée par `PolicyRuntime` |
| Un nouveau canal | Channel Runtime + Adapter | Transforme en `InboundRequest` |
| Une nouvelle source de connaissance | Adapter Knowledge | Lecture seule |
| Une logique transversale réutilisable | Skill ou Runtime | ADR si Runtime |
| Une modification de contrat public | Core ou Runtime | Versionnage + ADR + tests |

---

## 9. Processus de validation d'une évolution

1. **Identifier le besoin concret** (cas d'usage, bug, limitation).
2. **Vérifier s'il existe déjà une place** dans les Runtimes validés.
3. **Proposer une solution** en respectant les règles ci-dessus.
4. **Rédiger ou mettre à jour un ADR** si une décision structurante est modifiée.
5. **Implémenter avec tests de contrat**.
6. **Valider par review architecturale** si core ou contrat public touché.
7. **Merger**.

---

## 10. Anti-patterns sanctionnés

| Anti-pattern | Sanction |
|---|---|
| Import d'implémentation concrète dans un Runtime | Refactor obligatoire |
| Logique métier dans le core | Extraction dans un plugin |
| Capability qui appelle une autre capability | Utilisation d'Event Runtime |
| Plugin qui importe un autre plugin | Refactor obligatoire |
| Nouveau Runtime sans ADR | Rejet de la PR |
| Modification de contrat sans versionnage | Rejet de la PR |
| Page Agent exécute du métier | Extraction vers Action Runtime |
| Knowledge Runtime écrit dans une source métier | Refactor et ADR |
| Mémoire éparpillée dans les canaux | Centralisation dans Memory Runtime |

---

## 11. Promesse d'évolution

Ces règles garantissent qu'OIP pourra évoluer sur dix ans sans dégrader sa structure :

- **Remplaçabilité** : chaque technologie externe est interchangeable.
- **Modularité** : chaque Runtime a une frontière claire.
- **Testabilité** : chaque contrat public est testé.
- **Traçabilité** : toute décision structurante est documentée.
- **Simplicité** : aucune abstraction n'est ajoutée sans besoin concret.

---

> Document consolidé. Aucune règle ou abstraction supplémentaire n'a été introduite au-delà du socle validé.
