# Standard du Migration Backlog OIP

Version : `1.0.0-draft`  
Statut : Proposition — à valider avant tout Blueprint  
Date : 2026-07-09

---

## 1. Définition officielle

Le **Migration Backlog** est un document de planification obligatoire qui identifie les unités de migration nécessaires pour transformer progressivement une application vers OIP.

- Il ne décrit **pas** l'implémentation.
- Il ne décrit **pas** le code.
- Il ne détaille **pas** les tâches techniques.
- Il identifie et ordonne le **travail de migration**.

---

## 2. Place dans le cycle d'intégration

```text
Discovery
    ↓
Manifest Draft
    ↓
Manifest Architecture Review
    ↓
Manifest v1 (Approved)
    ↓
Migration Backlog (Validated)
    ↓
Migration Blueprint
    ↓
Shadow Mode
    ↓
Migration
    ↓
Cleanup
```

> **Règle absolue** : aucun Migration Blueprint ne peut être produit sans un Migration Backlog validé.

---

## 3. Artefacts complémentaires

| Artefact | Rôle | Contenu typique |
|---|---|---|
| **Manifest** | Décrire l'application. | Modules, services, capabilities, adapters, feature flags. |
| **Migration Backlog** | Décrire le travail. | Epics, Features, Migration Items, dépendances, risques. |
| **Migration Blueprint** | Décrire la stratégie d'exécution. | Plan par phase, Shadow Mode, migration incrémentale, rollback. |

Ces trois artefacts sont **complémentaires** et ne doivent jamais être fusionnés.

---

## 4. Structure officielle

Le Migration Backlog adopte la hiérarchie suivante :

```text
Epic
  ↓
  Feature
    ↓
    Migration Item
```

### Epic

Regroupement thématique de plusieurs Features. Représente un objectif métier significatif.

### Feature

Regroupement logique de Migration Items correspondant à une capacité métier cohérente.

### Migration Item

Unité autonome de migration, réalisable dans un Sprint ou un incrément raisonnable.

---

## 5. Champs obligatoires d'un Migration Item

Chaque Migration Item doit contenir au minimum :

| Champ | Description |
|---|---|
| `id` | Identifiant unique. |
| `title` | Titre synthétique. |
| `description` | Description du périmètre. |
| `businessObjective` | Objectif métier mesurable. |
| `justification` | Pourquoi cette migration est nécessaire. |
| `moduleIds` | Modules du Manifest concernés. |
| `serviceIds` | Services concernés. |
| `capabilityIds` | Capabilities concernées. |
| `runtimeIds` | Runtimes OIP impliqués. |
| `adapterIds` | Adaptateurs nécessaires. |
| `legacyComponents` | Composants legacy concernés. |
| `featureFlags` | Feature flags requis. |
| `dependencies` | IDs des Migration Items dont celui-ci dépend. |
| `priority` | `P0`, `P1`, `P2`, `P3`. |
| `riskLevel` | `low`, `medium`, `high`, `critical`. |
| `complexity` | Estimation qualitative (`small`, `medium`, `large`, `xlarge`). |
| `userImpact` | Description de l'impact utilisateur. |
| `acceptanceCriteria` | Critères d'acceptation. |
| `rollbackConditions` | Conditions de rollback. |

---

## 6. Dépendances

Le Migration Backlog doit contenir :

- un **graphe des dépendances** entre Migration Items ;
- l'identification du **chemin critique** ;
- les migrations **parallélisables** ;
- les migrations **bloquantes**.

---

## 7. Gestion des risques

Chaque Epic doit posséder :

- risques techniques ;
- risques métier ;
- risques utilisateurs ;
- stratégie de mitigation ;
- stratégie de rollback.

---

## 8. Roadmap

Le Migration Backlog doit inclure :

- une **Roadmap globale** ;
- l'ordre recommandé des Epics ;
- une estimation qualitative de l'effort ;
- les lots exécutables en parallèle.

---

## 9. Gouvernance

### Source unique

Le Migration Backlog est construit **exclusivement** à partir du Manifest v1 approuvé.

### Validation

Le Migration Backlog doit être validé par :

- l'équipe produit (cohérence métier) ;
- l'équipe architecture (faisabilité technique) ;
- l'équipe OIP (cohérence avec la plateforme).

### Mise à jour

Toute évolution du Manifest doit entraîner une mise à jour correspondante du Migration Backlog.

---

## 10. Format recommandé

Format YAML par défaut, JSON alternative.

Fichier attendu à la racine du dépôt de l'application :

```text
opays.migration-backlog.yaml
```

---

## 11. Exemple

Voir `examples/opays.migration-backlog.example.yaml` pour un exemple complet.

---

## 12. Références

- `docs/oip-integration-manifest-spec.md`
- `docs/oip-manifest-analysis-guide.md`
- `docs/oip-three-pillars-architecture.md`
- `docs/adr/adr-005-integration-manifest.md`
- `docs/adr/adr-006-oip-three-pillars.md`
- `docs/oip-roadmap-discovery-generator.md`
