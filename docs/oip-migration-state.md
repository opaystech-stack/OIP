# Migration State — États officiels d'intégration d'une application

Version : `1.0.0-draft`  
Statut : Proposition à valider  
Date : 2026-07-09

---

## 1. Principe

OIP distingue deux concepts :

- le **cycle de référence** : processus standard applicable à toute nouvelle application ;
- le **cycle d'exécution** : état réel de progression d'une application donnée, matérialisé par son **Migration State**.

Le cycle de référence est théorique et immuable. Le cycle d'exécution est concret et évolue avec le projet.

---

## 2. Cycle de référence

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

---

## 3. États officiels (Migration State)

### `Discovery`

L'application est en cours d'analyse. Aucun Manifest validé n'existe encore.

### `Manifest Draft`

Un Manifest initial a été proposé. Il est en cours de revue.

### `Manifest Architecture Review`

Le Manifest est en revue d'architecture. Il n'est pas encore approuvé.

### `Manifest Approved`

Le Manifest v1 a été approuvé. Il devient la source de vérité officielle.

### `Migration Backlog`

Le Migration Backlog a été construit à partir du Manifest approuvé et validé par les équipes.

### `Migration Blueprint`

Le Blueprint de migration a été rédigé et validé. La stratégie d'exécution est connue.

### `Shadow Mode`

OIP fonctionne en parallèle du système legacy, sans activer d'actions réelles. Permet de valider les comportements.

### `Migration`

Les capabilities sont progressivement activées via OIP. Le système legacy coexiste temporairement.

### `Cleanup`

Les composants legacy sont supprimés ou désactivés. L'application est entièrement pilotable par OIP.

### `Certified`

L'intégration est terminée et validée. L'application est officiellement intégrée à OIP.

---

## 4. Règles de transition

- Chaque transition doit être justifiée par un artefact validé.
- Un état ne peut être sauté sans ADR dédié.
- Le Manifest doit être approuvé avant la création du Migration Backlog.
- Le Migration Backlog doit être validé avant la rédaction du Blueprint.
- Le Blueprint doit être validé avant le Shadow Mode.

---

## 5. Stockage

Le Migration State d'une application est stocké dans son propre `opays.manifest.yaml` sous la section `migration.currentState`.

Exemple :

```yaml
migration:
  currentState: Migration Backlog
  validatedAt: "2026-07-09"
  validatedBy: architecture-team
```

---

## 6. Différence avec le cycle de référence

| Aspect | Cycle de référence | Migration State |
|---|---|---|
| Nature | Théorique, générique | Concret, propre à chaque application |
| Usage | Former les équipes, onboarder | Suivre la progression réelle |
| Mise à jour | Rare, par décision d'architecture | À chaque étape validée |
| Stockage | Documentation OIP | Manifest de l'application |

---

## 7. Références

- `docs/oip-integration-manifest-spec.md`
- `docs/oip-pilot-applications.md`
- `docs/oip-migration-backlog-standard.md`
- `docs/oip-manifest-analysis-guide.md`
- `examples/opays.manifest.example.yaml`
