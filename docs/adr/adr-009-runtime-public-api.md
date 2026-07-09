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

Accepted. Validé par l'API Readiness Review AR-002. L'implémentation de l'API publique est autorisée.

## Programme de maturation

L'ADR-009 a été le cœur de l'**API Readiness Program** défini dans `docs/oip-api-readiness-program.md`. Les six workstreams suivants ont été complétés et ont conduit au verdict READY de l'AR-002 :

1. Types publics — `docs/oip-runtime-api-public-types.md`.
2. Contrat officiel des opérations — `docs/oip-runtime-api-contract.md`.
3. Stratégie de versionnement — `docs/oip-runtime-api-versioning.md`.
4. Modèle de sécurité — `docs/oip-runtime-api-security.md`.
5. Gouvernance du catalogue — `docs/oip-runtime-api-governance.md`.
6. Exemples par transport — `docs/oip-runtime-api-examples.md`.

L'implémentation de l'API publique peut désormais commencer.

## Conséquences du verdict READY

- L'ADR-009 est officiellement **Accepted**.
- L'implémentation de l'API publique est autorisée dans OIP.
- Le plan d'implémentation est `docs/oip-runtime-api-implementation-plan.md`.
- Le blocage de MB-001 dans Opays-HQ sera levé dès que l'API HTTP, le SDK public, la Validation Suite et la documentation de mise en œuvre seront disponibles.

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
