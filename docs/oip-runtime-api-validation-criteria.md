# Critères de validation de l'API publique des Runtime OIP

Version : `1.0.0-draft`  
Statut : Document d'étude  
Date : 2026-07-09

---

## 1. Objectif

Définir les critères qui permettront de juger que la facade publique des Runtime OIP est suffisamment générique, stable et utilisable pour devenir l'API publique officielle.

---

## 2. Critères de validation

### 2.1 Généricité

| # | Critère | Preuve attendue |
|---|---|---|
| V1 | L'API n'est pas spécifique à Opays-HQ. | Au moins deux cas d'usage non-Opays-HQ documentés (Forex, application tierce, SDK, CLI, MCP). |
| V2 | Le contrat public est indépendant des implémentations internes. | Changement d'un `InMemory*Runtime` sans modification du contrat public possible dans les documents. |
| V3 | Les transports sont interchangeables. | Même opération appelable via SDK local, HTTP, et potentiellement MCP. |

### 2.2 Stabilité

| # | Critère | Preuve attendue |
|---|---|---|
| V4 | Le contrat est versionné globalement. | Version `v1` déclarée ; règles de montée de version documentées. |
| V5 | Les signatures des opérations `stable` ne changent pas dans `v1`. | Liste des opérations et de leur statut. |
| V6 | Les erreurs publiques sont stables et documentées. | Catalogue des codes d'erreur. |
| V7 | Les champs optionnels peuvent être ajoutés sans casser la compatibilité. | Règle documentée dans le contrat. |

### 2.3 Couverture fonctionnelle

| # | Critère | Preuve attendue |
|---|---|---|
| V8 | Le LLM est directement accessible. | Opérations `llm.generateText`, `llm.generateJson`, `llm.embed` définies. |
| V9 | La mémoire est accessible. | Opérations `memory.append`, `memory.recall`, `memory.remember` définies. |
| V10 | Les événements sont accessibles. | Opérations `events.publish`, `events.subscribe` définies. |
| V11 | Le contexte et la décision sont accessibles. | Opérations `context.build`, `decision.plan`, `decision.decide` définies. |
| V12 | L'action et le knowledge sont accessibles. | Opérations `actions.execute`, `knowledge.search`, `knowledge.ingest` définies. |
| V13 | Identity et Policy sont accessibles. | Opérations `identity.authenticate`, `identity.resolveWorkspace`, `policy.evaluate` définies. |

### 2.4 Sécurité et gouvernance

| # | Critère | Preuve attendue |
|---|---|---|
| V14 | L'authentification est externalisée. | `RuntimeContext` fourni, mécanisme d'auth non embarqué dans le contrat. |
| V15 | Les rôles et permissions sont pris en compte. | `RuntimeContext.user.roles` transmis aux opérations sensibles. |
| V16 | Les timeouts sont configurables. | Champ `timeoutMs` dans `OipPublicRequest`. |

### 2.5 Testabilité

| # | Critère | Preuve attendue |
|---|---|---|
| V17 | Chaque opération publique est testable dans la Validation Suite. | Scénario dédié par opération critique. |
| V18 | La facade peut être mockée pour les tests consommateurs. | Interface `OipPublicRuntimeApi` sans dépendance concrète. |

### 2.6 Documentation

| # | Critère | Preuve attendue |
|---|---|---|
| V19 | Le contrat public est documenté. | `docs/oip-runtime-api-contract.md` complet. |
| V20 | L'architecture est justifiée par un ADR. | ADR-009 accepté. |
| V21 | Le plan d'implémentation est clair. | `docs/oip-runtime-api-implementation-plan.md`. |
| V22 | Les risques sont identifiés. | `docs/oip-runtime-api-risk-analysis.md`. |

---

## 3. Critères d'acceptation finale

La proposition devient l'API publique officielle d'OIP si :

- [ ] V1 à V22 sont satisfaits.
- [ ] Au moins trois opérations critiques (LLM, Action, Memory) ont un scénario de Validation Suite.
- [ ] L'ADR-009 est accepté.
- [ ] Aucun Runtime existant n'a été modifié pour l'étude.
- [ ] Opays-HQ valide que le contrat permet le Shadow Mode LLM.

---

## 4. Conclusion de l'étude

Avant toute implémentation, une nouvelle itération de conception est recommandée si l'un des critères suivants n'est pas atteint :

- le contrat public n'est pas jugé assez générique ;
- les Runtimes internes sont encore trop instables ;
- la sécurité/authentification n'est pas suffisamment clarifiée.

Si tous les critères sont atteints, la facade publique peut être considérée comme la base officielle de l'API publique d'OIP.

---

## 5. Références

- `docs/oip-runtime-api-contract.md`
- `docs/oip-runtime-api-implementation-plan.md`
- `docs/oip-runtime-api-risk-analysis.md`
- `docs/adr/adr-009-runtime-public-api.md`
