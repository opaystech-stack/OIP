# Architecture Review — ADR-009 : API publique stable des Runtime OIP

Version : `1.0.0`  
Statut : Architecture Review — verdict à émettre  
Date : 2026-07-09  
Objet : ADR-009 — Facade publique stable avec expositions multiples

---

## 1. Contexte et périmètre

Cette revue porte sur l'ADR-009 et ses documents d'accompagnement. Elle ne concerne pas l'implémentation : aucune ligne de code, aucun endpoint, aucun Runtime ne doit être modifié avant le verdict final.

**Documents examinés :**

- `docs/adr/adr-009-runtime-public-api.md`
- `docs/oip-runtime-api-audit.md`
- `docs/oip-runtime-api-comparison.md`
- `docs/oip-runtime-api-contract.md`
- `docs/oip-runtime-api-implementation-plan.md`
- `docs/oip-runtime-api-risk-analysis.md`
- `docs/oip-runtime-api-validation-criteria.md`

**Objectif de la revue :** déterminer si la proposition d'architecture est suffisamment cohérente, stable, sécurisée et générique pour devenir le contrat public officiel d'OIP, ou si une nouvelle itération de conception est nécessaire.

---

## 2. Résumé de la proposition

L'ADR-009 recommande l'**Option C** :

> Une **facade publique stable** (`OipPublicRuntimeApi`) expose des **opérations** nommées. Les Runtimes concrets restent internes. Le contrat peut être implémenté par un SDK local, une API HTTP unique (`POST /v1/oip/invoke`), un serveur MCP, une CLI ou toute exposition future.

Principe fondamental : l'API publique expose des **opérations**, pas des **Runtimes**.

---

## 3. Analyse par critère

### 3.1 Cohérence globale de la facade publique

#### Observations

- Le contrat est centré sur une interface unique `OipPublicRuntimeApi` avec une méthode `invoke`.
- Toutes les opérations partagent les mêmes structures `OipPublicRequest`, `OipPublicResponse`, `OipPublicError`.
- Le catalogue d'opérations couvre 11 domaines et 21 opérations.

#### Points forts
- Homogénéité du contrat : un seul modèle de requête/réponse.
- Facilité à générer des clients, de la documentation, des tests.
- Les opérations sont nommées par domaine (`llm.generateText`, `memory.recall`), ce qui reste lisible.

#### Points de vigilance
- L'opération `events.subscribe` est problématique dans un modèle request/response synchrone (besoin de streaming ou de webhook).
- `decision.plan` et `decision.decide` peuvent être confondues ; la distinction doit être explicite dans la documentation.
- `knowledge.ingest` et `documents` existent en parallèle dans le runtime actuel ; le routeur devra choisir clairement.

#### Verdict partiel
**COHÉRENT** — sous réserve de clarifications sur `events.subscribe`, `decision.*` et `knowledge`/`documents`.

---

### 3.2 Stabilité à long terme du contrat

#### Observations

- Le contrat dépend d'un type `JsonObject` et de `RuntimeContext`.
- Les opérations sont découplées des implémentations internes.
- Les Runtimes peuvent être remplacés sans impacter les clients.

#### Points forts
- Faible couplage entre consommateurs et implémentations.
- `OipPublicRuntimeApi` est une interface abstraite : les clients en dépendent, pas de classes concrètes.

#### Points de vigilance
- `RuntimeContext` est aujourd'hui défini dans `core/src/types.ts`. Sa stabilité n'est pas formellement garantie. Il doit être traité comme un contrat public à part entière.
- `JsonObject` est un type interne. Sa définition est simple mais doit être figée.
- Si une opération a besoin d'un type spécifique (ex: `LlmMessage`), ce type doit faire partie du contrat public.

#### Verdict partiel
**STABLE** — sous réserve de formaliser `RuntimeContext`, `JsonObject` et les types spécifiques d'opérations comme partie intégrante du contrat public.

---

### 3.3 Stratégie de versionnement

#### Observations

- Version globale `v1` pour tout le contrat public.
- Opérations additives autorisées dans `v1.x`.
- Changement de signature = nouvelle version majeure.
- Chaque opération expose `since`, `deprecated`, `removed`.

#### Points forts
- Simplicité : un seul numéro de version à communiquer.
- Permet l'évolution additive sans fracture.

#### Points de vigilance
- La version globale crée un couplage implicite : une opération qui change de signature force tout le contrat en `v2`, même si les autres opérations n'ont pas changé.
- Pour un contrat à très grande échelle (dizaines d'opérations), cela peut devenir pénalisant.
- Aucune règle n'est définie pour la coexistence de versions (`v1` et `v2` en parallèle).

#### Verdict partiel
**ACCEPTABLE** — mais la stratégie globale doit être complétée par des règles de coexistence et par une politique de durée de vie des versions.

---

### 3.4 Sécurité et authentification

#### Observations

- La facade reçoit un `RuntimeContext` contenant l'identité.
- L'authentification est volontairement **externalisée** du contrat public.
- Les rôles transitent via `RuntimeContext.user.roles`.

#### Points forts
- Séparation claire : transport s'authentifie, facade s'autorise.
- Permet plusieurs mécanismes d'authentification (API key, JWT, mTLS, SSO interne).

#### Points de vigilance
- Le contrat public ne dit pas comment `RuntimeContext` est construit : c'est une responsabilité du transport. Cela peut créer des incohérences entre SDK local et HTTP.
- Aucune mention de rate limiting, quotas, scopes ou audit de sécurité.
- `events.subscribe` en HTTP nécessite une gestion des subscriptions (SSE, websocket, webhook) qui n'est pas définie.
- Aucune mention de chiffrement, de secrets, ou de validation de tokens.

#### Verdict partiel
**INCOMPLET** — l'architecture est saine mais la couche de sécurité doit être détaillée avant implémentation. Une étude sécurité dédiée est recommandée.

---

### 3.5 Performances

#### Observations

- La facade ajoute une indirection (routeur) entre le consommateur et les Runtimes.
- Les opérations coûteuses sont les Runtimes eux-mêmes (LLM, recherche, ingestion).

#### Points forts
- L'indirection est négligeable par rapport aux coûts des Runtimes.
- Possibilité d'optimiser le routeur (cache, batching) sans changer le contrat.

#### Points de vigilance
- Si le routeur devient un point central de contention, il faudra le rendu horizontalisable.
- Aucune stratégie de cache n'est définie pour les opérations répétitives.
- Les timeouts sont configurables mais les valeurs par défaut doivent être validées par usage.

#### Verdict partiel
**ACCEPTABLE** — les performances dépendront surtout de l'implémentation du routeur et des Runtimes sous-jacents.

---

### 3.6 Compatibilité avec HTTP, SDK, CLI, MCP, Automation

#### Observations

- Le contrat est transport-agnostique.
- L'API HTTP unique (`POST /v1/oip/invoke`) est proposée.
- Le SDK local implémente la même interface.
- MCP et Automation peuvent mapper les opérations.

#### Points forts
- Cohérence cross-transport : une seule sémantique d'opération.
- Génération automatique de clients possible.

#### Points de vigilance
- MCP fonctionne souvent avec des outils nommés. La granularité des 21 opérations est-elle la bonne pour MCP ? Par exemple, `llm.generateText` et `llm.generateJson` pourraient être un seul outil `llm.generate` avec un paramètre `format`.
- Automation pourrait préférer un modèle event-driven plutôt que request/response.
- La CLI gagnerait à avoir une syntaxe par opération, pas seulement `oip invoke ...`.

#### Verdict partiel
**COMPATIBLE** — avec des adaptations de présentation par transport, mais sans changer le contrat sous-jacent.

---

### 3.7 Facilité d'intégration pour les applications futures

#### Observations

- Une application n'a qu'à appeler des opérations nommées.
- Aucune connaissance des Runtimes internes n'est requise.

#### Points forts
- Très faible courbe d'apprentissage.
- Documentation et SDK facilitent l'intégration.
- Les opérations reflètent des besoins métier clairs.

#### Points de vigilance
- Les applications devront quand même comprendre `RuntimeContext` et le cycle de confirmation des actions sensibles.
- Les types de payload par opération doivent être documentés avec des exemples.

#### Verdict partiel
**BONNE** — la facilité d'intégration est un des points forts de la proposition.

---

### 3.8 Risques de dette technique et évolution pluriannuelle

#### Observations

- Le routeur central pourrait accumuler des règles métier au fil du temps.
- L'ajout continu d'opérations pourrait faire grossir la facade.

#### Points forts
- Les documents reconnaissent ces risques et proposent des mitigations (routeur-only, gouvernance stricte).
- Le versionnement permet de marquer des opérations obsolètes.

#### Points de vigilance
- Aucun mécanisme de gouvernance n'est formalisé pour décider qu'une nouvelle opération entre dans le contrat public.
- Aucune feuille de route pluriannuelle du contrat public n'est fournie.
- L'évolution des Runtimes internes non stables (`knowledge-runtime` est un stub, `llm-runtime` est embryonnaire) pourrait forcer des ajustements du routeur avant que certaines opérations ne soient marquées `stable`.

#### Verdict partiel
**GÉRABLE** — mais une gouvernance du catalogue d'opérations doit être ajoutée.

---

### 3.9 Alternatives éventuelles et raisons de leur rejet

#### Option A — API HTTP par Runtime

**Rejet confirmé** :
- Surface publique trop grande et fragmentée.
- Versionnement difficile à maintenir à l'échelle.
- Duplication des contrats communs (authentification, erreurs, contexte).
- Tendance à exposer les détails d'implémentation plutôt que les opérations métier.

**Exception future** : l'option A peut être générée comme **exposition secondaire** à partir de la facade, mais elle ne sera jamais le contrat public primaire.

#### Option B — Facade publique unique sans expositions multiples

**Rejet confirmé** :
- Trop restrictif pour un écosystème qui doit supporter HTTP, SDK, CLI, MCP et Automation.
- L'option C l'englobe tout en gardant la même simplicité pour le cas par défaut.

#### Option D — Exposition directe des interfaces `*Runtime`

**Rejet confirmé** :
- Violerait le principe fondamental « exposer des opérations, pas des Runtimes ».
- Les interfaces internes ne sont pas assez stables et ne doivent pas devenir des contrats publics.

#### Option E — GraphQL ou gRPC comme contrat principal

**Non retenu pour l'instant** :
- GraphQL ajoute une complexité de schéma et de sécurité (query depth, introspection) non justifiée à ce stade.
- gRPC est puissant mais moins accessible pour les SDK et CLI légers.
- L'option C peut ajouter des bindings GraphQL/gRPC ultérieurement sans changer le contrat.

---

## 4. Synthèse des verdicts partiels

| Critère | Verdict | Remarque |
|---|---|---|
| Cohérence globale | COHÉRENT | Clarifier `events.subscribe`, `decision.*`, `knowledge`/`documents` |
| Stabilité long terme | STABLE | Formaliser `RuntimeContext`, `JsonObject`, types d'opérations |
| Versionnement | ACCEPTABLE | Compléter coexistence versions + durée de vie |
| Sécurité / Auth | INCOMPLET | Étude sécurité dédiée recommandée |
| Performances | ACCEPTABLE | Router cost négligeable |
| Compatibilité transports | COMPATIBLE | Adaptations de présentation possibles |
| Facilité d'intégration | BONNE | Exemples de payloads nécessaires |
| Dette technique / évolution | GÉRABLE | Gouvernance du catalogue à formaliser |
| Rejet des alternatives | CONFIRMÉ | A, B, D rejetées ; E différée |

---

## 5. Verdict global

### **NOT READY**

L'architecture proposée par l'ADR-009 est **cohérente, stable et générique**, mais elle n'est pas encore prête à devenir le contrat public officiel d'OIP. Les lacunes identifiées sont toutes de nature documentaire/gouvernance ; aucune remise en cause de l'Option C n'est nécessaire.

### 5.1 Conditions de passage à READY

Avant de marquer l'ADR-009 comme `Accepted` et de lancer l'implémentation, les points suivants doivent être traités :

1. **Formaliser les contrats publics complémentaires**
   - `RuntimeContext`
   - `JsonObject`
   - Types spécifiques d'opérations (`LlmMessage`, `MemoryEntry`, etc.)
   - Faire de ces types des contrats publics de premier plan.

2. **Clarifier les opérations ambiguës**
   - `events.subscribe` : préciser le modèle de livraison (SSE, webhook, polling).
   - `decision.plan` vs `decision.decide` : différencier explicitement.
   - `knowledge.ingest` vs documents : définir la frontière.

3. **Compléter la stratégie de versionnement**
   - Règles de coexistence de versions (`v1` + `v2` en parallèle).
   - Politique de durée de vie (deprecation, retrait).
   - Comment annoncer une nouvelle version aux consommateurs.

4. **Conduire une étude sécurité dédiée**
   - Authentification et construction du `RuntimeContext` par transport.
   - Rate limiting, quotas, scopes.
   - Audit de sécurité.
   - Gestion des subscriptions et streaming.

5. **Formaliser la gouvernance du catalogue d'opérations**
   - Processus d'ajout d'une opération publique.
   - Critères d'acceptation d'une opération (au moins 2 consommateurs, Validation Suite, revue sécurité).
   - Qui décide de l'ajout/retrait.

6. **Produire des exemples concrets de payloads**
   - Un exemple par opération critique.
   - Exemples pour SDK local, HTTP, CLI et MCP.

---

## 6. Recommandations

1. **Ne pas implémenter** l'ADR-009 avant que les 6 conditions ci-dessus soient satisfaites.
2. **Créer un document de sécurité** dédié : `docs/oip-runtime-api-security.md`.
3. **Créer un document de gouvernance** du catalogue : `docs/oip-runtime-api-governance.md`.
4. **Mettre à jour `docs/oip-runtime-api-contract.md`** avec les types publics formalisés et les exemples.
5. **Conserver Opays-HQ bloqué sur MB-001** jusqu'à acceptation de l'ADR-009 + implémentation + tests + documentation.
6. **Prévoir une revue sécurité formelle** avant toute mise en production de l'API HTTP.

---

## 7. Références

- `docs/adr/adr-009-runtime-public-api.md`
- `docs/oip-runtime-api-contract.md`
- `docs/oip-runtime-api-comparison.md`
- `docs/oip-runtime-api-risk-analysis.md`
- `docs/oip-runtime-api-validation-criteria.md`
- `docs/oip-pilot-applications.md`
- MB-001 — Pre-Flight API Validation
