# Architecture conceptuelle — OIP : Discovery · Generator · Runtime

Version : `1.0.0-draft`  
Statut : Proposition d'architecture à valider  
Date : 2026-07-08

---

## 1. Vision

OIP devient la plateforme officielle de conception, de génération et d'intégration des applications Opays.

Trois piliers autonomes communiquent uniquement via le **Manifest** :

```text
                 ┌─────────────┐
                 │   Manifest  │
                 │  (contrat)  │
                 └──────┬──────┘
                        │
        ┌───────────────┼───────────────┐
        │               │               │
        ▼               ▼               ▼
   ┌─────────┐    ┌──────────┐    ┌─────────┐
   │Discovery│    │Generator │    │ Runtime │
   │  (lire) │    │ (créer)  │    │(exécuter)│
   └─────────┘    └──────────┘    └─────────┘
```

---

## 2. Piliers

### 2.1 Discovery

- **Mission** : comprendre une application existante sans jamais la modifier.
- **Entrée** : codebase d'une application.
- **Sortie principale** : `opays.manifest.yaml` proposé.
- **Sortie secondaire** : rapport d'analyse.
- **Contrainte** : ne dépend jamais du Runtime.
- **Contrainte** : ne réécrit jamais automatiquement un Manifest validé.

### 2.2 Generator

- **Mission** : créer une nouvelle application à partir d'un Manifest validé.
- **Entrée** : `opays.manifest.yaml` validé.
- **Sortie** : codebase complète de l'application générée.
- **Contrainte** : ne dépend jamais du Runtime.
- **Contrainte** : ne connaît aucun domaine métier particulier.

### 2.3 Runtime

- **Mission** : exécuter l'intelligence métier.
- **Entrée** : requêtes utilisateur + plugins/capabilities/adapters.
- **Sortie** : actions exécutées, événements, résultats structurés.
- **Contrainte** : ne dépend jamais du Discovery ni du Generator.
- **Contrainte** : reste la fondation inchangée d'OIP.

---

## 3. Manifest — cœur du système

Le Manifest est le **seul contrat public** entre les trois piliers.

Il décrit :

- l'identité de l'application ;
- les modules métier ;
- les services et routes ;
- les capabilities ;
- les adaptateurs ;
- les dépendances ;
- les feature flags ;
- la compatibilité OIP ;
- les règles de migration.

Toutes les opérations commencent et terminent par le Manifest.

---

## 4. Flux de cycle de vie

### 4.1 Nouvelle application

```text
Idée
  ↓
Manifest (rédigé ou assisté)
  ↓
Validation humaine
  ↓
Generator → codebase initiale
  ↓
Développement itératif
  ↓
Runtime intégré nativement
  ↓
Évolution via Manifest
```

### 4.2 Application existante

```text
Application
  ↓
Discovery → Manifest proposé
  ↓
Validation humaine
  ↓
Manifest validé
  ↓
Blueprint de migration
  ↓
Shadow Mode
  ↓
Migration incrémentale
  ↓
Runtime intégré
  ↓
Évolution via Manifest
```

### 4.3 Convergence

Les deux flux convergeant vers un cycle de vie unique.

---

## 5. Principes de découplage

| Relation | Règle |
|---|---|
| Discovery → Runtime | Aucune dépendance. |
| Generator → Runtime | Aucune dépendance. |
| Discovery → Generator | Aucune dépendance directe. Communication via Manifest. |
| Runtime → Manifest | Le Runtime lit le Manifest uniquement pour compatibilité et chargement. |
| Generator → Manifest | Le Generator est entièrement piloté par le Manifest. |
| Discovery → Application | Lecture seule. Aucune écriture. |

---

## 6. Standards partagés

Toutes les applications générées ou migrées partagent :

- la même structure de packages ;
- les mêmes conventions de nommage ;
- les mêmes points d'extension (plugins/adapters) ;
- le même format de Manifest ;
- la même stratégie de CI/CD ;
- la même intégration avec OIP Runtime.

---

## 7. Évolutivité

- Le Manifest est versionné et stable.
- Les piliers peuvent évoluer indépendamment tant qu'ils respectent le contrat.
- Les plugins portent toute la spécialisation métier.
- Aucune logique spécifique à une application ne réside dans OIP.

---

## 8. Références

- `docs/oip-integration-manifest-spec.md`
- `docs/opays.manifest.schema.json`
- `docs/adr/adr-005-integration-manifest.md`
- `docs/adr/adr-006-oip-three-pillars.md`
- `docs/rfc/rfc-001-discovery-generator-runtime-contracts.md`
- `docs/oip-target-package-structure.md`
- `docs/oip-discovery-role.md`
- `docs/oip-generator-role.md`
- `docs/oip-discovery-to-manifest.md`
- `docs/oip-generator-from-manifest.md`
- `docs/oip-roadmap-discovery-generator.md`
