---
status: proposed
date: 2026-07-09
title: ADR-009 — API publique stable des Runtime OIP via une facade unique
---

# ADR-009 : API publique stable des Runtime OIP via une facade unique

## Contexte

OIP expose aujourd'hui une API publique centrée sur `OipRuntime` et `ChatService`. Cette surface est suffisante pour construire une application par composition de plugins, mais elle ne fournit pas de contrats stables par domaine fonctionnel.

Le pilote Opays-HQ est bloqué sur MB-001 car l'API actuelle ne permet pas à une application externe d'utiliser directement le LLM Runtime en Shadow Mode. Le endpoint `/chat` de l'exemple d'API mélange planification, exécution et mémoire, ce qui ne convient pas à un usage en parallèle d'un moteur legacy.

## Problème

Comment OIP doit-il exposer publiquement ses Runtimes pour que des applications externes puissent les consommer sans dépendre des implémentations internes ?

## Options considérées

### Option A — Une API HTTP par Runtime

Exposer chaque Runtime sous forme d'endpoints HTTP indépendants.

- **Pour** : granularité fine, scalabilité par domaine.
- **Contre** : surface publique trop grande, versionnement fragmenté, lourd pour SDK/CLI, duplication des contrats communs.

### Option B — Une facade publique unique

Exposer un seul point d'entrée `OipPublicRuntimeApi` avec des opérations nommées.

- **Pour** : surface minimale, versionnement centralisé, SDK simple.
- **Contre** : moins naturel pour une exposition REST pure, routeur central.

### Option C — Facade publique stable + expositions multiples

Combiner une facade unique avec la capacité à générer des expositions secondaires (SDK, HTTP unique, endpoints REST par Runtime, MCP, CLI).

- **Pour** : stabilité du contrat central, flexibilité des transports, généricité maximale.
- **Contre** : nécessite une conception rigoureuse du routeur.

## Décision

**Choisir l'Option C : Facade publique stable + expositions multiples.**

OIP expose des **opérations** stables, pas des **Runtimes** concrets. Les Runtimes restent des abstractions internes. Le contrat public est la facade `OipPublicRuntimeApi`.

## Conséquences

### Positives

- Les consommateurs ne dépendent pas des implémentations internes.
- Le contrat est versionné globalement (`v1`).
- Le SDK, l'API HTTP, MCP et le CLI partagent le même contrat.
- Opays-HQ peut appeler `llm.generateText` pour le Shadow Mode sans utiliser `/chat`.
- Les futures applications (Forex, etc.) réutilisent le même contrat.
- Les Runtimes peuvent évoluer sans casser les clients.

### Négatives

- Introduction d'un routeur central qu'il faut maintenir fin.
- Nécessite une documentation et une Validation Suite renforcées.
- L'exposition REST optionnelle peut être perçue comme un écart avec l'architecture principale.

## État

Proposed. Soumis à l'API Readiness Program. Ne sera implémenté qu'après un verdict **READY** de l'AR-002.

## Programme de maturation

L'ADR-009 est maintenant le cœur de l'**API Readiness Program** défini dans `docs/oip-api-readiness-program.md`. Six workstreams doivent être complétés avant l'implémentation :

1. Types publics (`docs/oip-runtime-api-public-types.md`).
2. Clarification des opérations publiques (`docs/oip-runtime-api-contract.md` mis à jour).
3. Stratégie de versionnement et dépréciation (`docs/oip-runtime-api-versioning.md`).
4. Modèle de sécurité (`docs/oip-runtime-api-security.md`).
5. Gouvernance du catalogue (`docs/oip-runtime-api-governance.md`).
6. Exemples par transport (`docs/oip-runtime-api-examples.md`).

La revue finale AR-002 émettra le verdict `READY` ou `NOT READY`.

## Conséquences du verdict

- **READY** : l'ADR-009 passe à `Accepted` ; l'implémentation de l'API publique est lancée dans OIP ; le blocage de MB-001 dans Opays-HQ pourra être levé.
- **NOT READY** : nouvelle itération du programme ; Opays-HQ reste bloqué sur MB-001 ; aucune implémentation.

## Références

- `docs/oip-runtime-api-audit.md`
- `docs/oip-runtime-api-comparison.md`
- `docs/oip-runtime-api-contract.md`
- `docs/oip-runtime-api-implementation-plan.md`
- `docs/oip-runtime-api-risk-analysis.md`
- `docs/oip-runtime-api-validation-criteria.md`
- `docs/oip-api-readiness-program.md`
- `docs/architecture-reviews/ar-002-api-readiness-review.md`
- MB-001 — Pre-Flight API Validation
