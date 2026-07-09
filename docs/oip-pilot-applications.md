# Applications pilotes OIP

Ce document présente l'état réel de progression des applications intégrées ou en cours d'intégration à OIP. Il ne doit pas être confondu avec le cycle théorique d'intégration défini dans `docs/oip-integration-manifest-spec.md`.

---

## Principe

OIP définit :

- un **cycle de référence** applicable à toute nouvelle application ;
- un **cycle d'exécution** propre à chaque application, matérialisé par son **Migration State**.

Le cycle de référence décrit les étapes idéales. Le cycle d'exécution reflète l'état réel du projet.

---

## Cycle de référence OIP

```text
Discovery
    ↓
Manifest Draft
    ↓
Manifest Architecture Review
    ↓
Manifest Approved
    ↓
Migration Backlog
    ↓
Migration Blueprint
    ↓
Shadow Mode
    ↓
Migration
    ↓
Cleanup
    ↓
Certified
```

Voir `docs/oip-migration-state.md` pour la définition officielle des états.

---

## État des applications pilotes

### OIP (plateforme)

| Champ | Valeur |
|---|---|
| Nom | OIP — Opays Intelligence Platform |
| Type | Plateforme interne |
| Migration State | `Certified` |
| Manifest | N/A |
| Artefacts validés | Architecture, gouvernance, Manifest system, Migration Backlog system, Runtime v0.1.0-alpha |
| Prochaine étape autorisée | Poursuivre l'évolution des piliers Discovery, Generator, Runtime selon la roadmap. |

---

### Opays-HQ

| Champ | Valeur |
|---|---|
| Nom | Opays HQ |
| Type | Application existante |
| Manifest | `opays.manifest.yaml` v1.0.0 approuvé |
| Migration State | `Migration Backlog` |
| Artefacts validés | Discovery terminé, Manifest v1.0.0 validé, Migration Backlog construit et validé |
| Prochaine étape autorisée | **Migration Blueprint** |
| Étapes déjà franchies | Discovery ✅, Manifest Draft ✅, Manifest Architecture Review ✅, Manifest Approved ✅, Migration Backlog ✅ |
>
> **Important** : il est interdit de recommencer un Discovery ou une revalidation du Manifest pour Opays-HQ sans justification métier majeure. Le cycle d'exécution de cette application part de son état actuel.
>
> **Blocage actuel** : MB-001 était bloqué en attendant l'implémentation de l'API publique OIP. La première opération publique (`llm.generateText`) est maintenant implémentée, testée et exposée via la facade `OipPublicApi`, le routeur HTTP `POST /v1/oip/invoke` et le SDK `@opaystech/oip/public`. Opays-HQ peut reprendre MB-001 en Shadow Mode.

---

## Règles de mise à jour

- Ce document est mis à jour chaque fois qu'une application change d'état.
- L'évolution d'un état doit être justifiée par un artefact validé.
- Aucune application ne peut sauter une étape sans ADR dédié.
- **Opays-HQ est actuellement bloqué sur MB-001 dans le cadre de l'API Readiness Program. Aucun développement applicatif ne reprendra avant le verdict READY de l'AR-002. Le verdict READY a été émis le 2026-07-09 ; le blocage est levé depuis l'implémentation de la première opération publique `llm.generateText`, testée et exposée via `OipPublicApi`, `POST /v1/oip/invoke` et `@opaystech/oip/public`.**

---

## Références

- `docs/oip-migration-state.md`
- `docs/oip-integration-manifest-spec.md`
- `docs/oip-migration-backlog-standard.md`
- `docs/oip-three-pillars-architecture.md`
- `docs/oip-roadmap-discovery-generator.md`
- `docs/oip-runtime-api-contract.md`
- `docs/oip-api-readiness-program.md`
- `docs/architecture-reviews/ar-002-api-readiness-review.md`
