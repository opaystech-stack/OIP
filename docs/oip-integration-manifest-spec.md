# Spécification du Manifest d'intégration OIP

Version du document : `1.0.0-draft`  
Statut : Proposition d'architecture — à valider avant toute migration

---

## 1. Principe fondamental

OIP ne dépendra jamais directement de la structure interne d'une application.  
Chaque application intégrée possède son propre **Manifest d'intégration versionné** (`opays.manifest.yaml` ou `opays.manifest.json`). Ce Manifest est l'**unique contrat** entre l'application et OIP.

L'analyse automatique d'une codebase n'est plus une finalité : c'est un outil de génération et de mise à jour du Manifest. Le Manifest devient ensuite la source de vérité.

> **Règle absolue** : aucune logique spécifique à une application ne doit être ajoutée dans le moteur OIP.

---

## 1.1 Cycle d'intégration officiel

Le cycle officiel d'intégration d'une application existante à OIP est :

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

**Aucun Migration Blueprint ne peut être produit sans un Migration Backlog validé.**

---

## 2. Format recommandé

Le format par défaut est **YAML**. Il est plus lisible par les humains qui valideront le Manifest.  
Le format JSON est accepté comme alternative stricte, notamment pour les outils qui le préfèrent.

Fichier attendu à la racine du dépôt de l'application :

```text
opays.manifest.yaml
```

ou

```text
opays.manifest.json
```

---

## 3. Schéma initial du Manifest

### 3.1 Métadonnées

| Champ | Type | Obligatoire | Description |
|---|---|---|---|
| `manifestVersion` | `string` (SemVer) | ✅ | Version du Manifest lui-même. |
| `application.id` | `string` | ✅ | Identifiant unique de l'application. |
| `application.name` | `string` | ✅ | Nom lisible. |
| `application.description` | `string` | ❌ | Description fonctionnelle. |
| `application.repository` | `string` (URL) | ❌ | URL du dépôt. |
| `oipCompatibility.min` | `string` (SemVer) | ✅ | Version minimale d'OIP supportée. |
| `oipCompatibility.max` | `string` (SemVer) | ❌ | Version maximale d'OIP testée (borne inclusive). |
| `oipCompatibility.reason` | `string` | ❌ | Raison de la contrainte. |

### 3.2 Modules métier

```yaml
modules:
  - id: customers
    name: Gestion des clients
    description: Création, mise à jour et recherche de fiches client.
    version: "2.1.0"
```

### 3.3 Services exposés

```yaml
services:
  - id: customer-service
    name: Customer Service
    moduleId: customers
    type: http
    adapter: CustomerServiceAdapter
    endpoints:
      - path: /api/customers
        method: POST
        purpose: createCustomer
      - path: /api/customers/{id}
        method: GET
        purpose: getCustomer
```

### 3.4 Routes API existantes

```yaml
api:
  basePath: /api/v2
  routes:
    - path: /customers
      method: POST
      description: Crée un client
      aiRelevant: true
    - path: /invoices
      method: GET
      description: Liste des factures
      aiRelevant: false
```

### 3.5 Points d'entrée IA existants

```yaml
aiEntrypoints:
  - id: chat-widget
    type: chat
    description: Widget de chat métier
    channels:
      - web
      - mobile
  - id: command-voice
    type: voice
    description: Commande vocale de saisie rapide
```

### 3.6 Composants à remplacer par OIP

```yaml
componentsToReplace:
  - id: legacy-nlp-parser
    type: nlp-parser
    description: Parser de langage naturel maison
    migrationPhase: 2
  - id: legacy-intent-router
    type: intent-router
    description: Routeur d'intentions vers actions métier
    migrationPhase: 2
```

### 3.7 Capabilities candidates

```yaml
capabilities:
  - id: business.customer.create
    moduleId: customers
    description: Créer une fiche client
    parameters:
      - name: name
        type: string
        required: true
      - name: email
        type: string
        required: true
      - name: phone
        type: string
        required: false
    requiredRoles:
      - sales.manager
    confirmationLevel: none
    toolHandler: createCustomer
    emits:
      - CustomerCreated
```

### 3.8 Adaptateurs OIP nécessaires

```yaml
adapters:
  - id: identity
    name: IdentityAdapter
    description: Résout l'utilisateur et son workspace depuis l'application.
  - id: business-tools
    name: BusinessToolAdapter
    description: Appelle les services métiers de l'application depuis les tools OIP.
  - id: memory
    name: MemoryAdapter
    description: Persiste la mémoire conversationnelle dans la base de l'application.
  - id: audit
    name: AuditAdapter
    description: Écrit les audits dans le système de logs de l'application.
  - id: events
    name: EventAdapter
    description: Publie les événements OIP dans le bus métier de l'application.
  - id: knowledge
    name: KnowledgeAdapter
    description: Connecte les documents/procedures métiers à KnowledgeEngine.
```

### 3.9 Dépendances critiques

```yaml
dependencies:
  runtime:
    - name: nodejs
      minVersion: "20.0.0"
  data:
    - name: postgresql
      purpose: Persistence métier
  external:
    - name: openai
      purpose: LLM pour la génération de plans
      optional: true
```

### 3.10 Feature Flags de migration

```yaml
featureFlags:
  - id: oip-shadow-mode
    description: OIP fonctionne en parallèle sans activer les actions.
    default: true
  - id: oip-customer-create
    description: Active la capability business.customer.create via OIP.
    default: false
    dependsOn:
      - oip-shadow-mode
```

### 3.11 Règles de compatibilité et migration

```yaml
migration:
  currentPhase: analysis
  phases:
    - id: analysis
      name: Analyse
      done: true
    - id: manifest
      name: Manifest
      done: true
    - id: blueprint
      name: Blueprint de migration
      done: false
    - id: shadow
      name: Shadow Mode
      done: false
    - id: progressive
      name: Migration progressive
      done: false
    - id: cleanup
      name: Suppression du moteur legacy
      done: false

compatibilityRules:
  - description: Les anciens endpoints de chat restent actifs tant que le shadow mode n'est pas validé.
    condition: featureFlag(oip-shadow-mode) == true
  - description: Aucune action OIP ne modifie les données en écriture avant confirmation métier.
    condition: currentPhase in [shadow, progressive, cleanup]
```

---

## 4. Règles de versionnement du Manifest

Le `manifestVersion` suit [SemVer 2.0.0](https://semver.org/lang/fr/).

| Incrément | Signification | Exemples |
|---|---|---|
| **MAJOR** | Changement incompatible pour OIP ou pour l'application : retrait de capability, changement de contrat d'adaptateur, renommage de module. | `1.2.3` → `2.0.0` |
| **MINOR** | Ajout non cassant : nouvelle capability, nouveau service, nouveau module, nouvelle route. | `1.2.3` → `1.3.0` |
| **PATCH** | Correction, précision, documentation sans impact fonctionnel. | `1.2.3` → `1.2.4` |

### Règles de stabilité

- Une fois publié dans un dépôt, un Manifest **ne doit jamais être modifié silencieusement**.
- Chaque modification est un commit dédié avec un message explicite.
- Une évolution incompatible avec une version OIP existante doit être documentée dans un ADR côté OIP **et** côté application.

---

## 5. Processus d'analyse et de mise à jour

### 5.1 Cycle officiel

```text
Analyse de la codebase
        ↓
Comparaison avec le Manifest existant
        ↓
Génération d'un diff proposé
        ↓
Validation humaine obligatoire
        ↓
Mise à jour du Manifest (commit dédié)
        ↓
Toutes les migrations utilisent ce Manifest
```

### 5.2 Si aucun Manifest n'existe

L'analyse génère un Manifest initial complet. Ce Manifest est proposé sous forme de fichier dans une branche dédiée (ex. `feat/oip-manifest-init`). Il est ensuite validé, corrigé et fusionné.

### 5.3 Si un Manifest existe déjà

L'analyse **ne réécrit jamais** le Manifest existant. Elle produit :

- un rapport des écarts entre la codebase et le Manifest ;
- une liste de propositions d'évolution (ajouts, suppressions, corrections) ;
- un fichier `opays.manifest.proposed.yaml` en diff.

Seul un humain peut appliquer ces propositions au Manifest officiel, après validation.

### 5.4 Personnalisations manuelles

Toute modification manuelle du Manifest est conservée. L'analyse identifie les sections qui semblent manuelles (champs `source: manual`, commentaires explicites) et les protège.

---

## 6. Stratégie de compatibilité OIP / Manifest

### 6.1 Lecture par OIP

Au démarrage, OIP (ou l'adaptateur d'intégration) lit le Manifest et vérifie :

1. La présence des champs obligatoires.
2. La cohérence du `manifestVersion` avec le parser OIP.
3. La compatibilité avec la version courante d'OIP via `oipCompatibility`.

### 6.2 Gestion des versions

- OIP annonce les versions de Manifest qu'il sait lire.
- Si le `manifestVersion` est trop ancien, OIP peut refuser de démarrer ou appliquer un adaptateur de compatibilité documenté.
- Si le `manifestVersion` est trop récent, OIP refuse clairement avec un message explicite.

### 6.3 Table de compatibilité (exemple)

| Version OIP | Manifest v1.x | Manifest v2.x |
|---|---|---|
| OIP 0.1.x | ✅ Compatible | ❌ Trop récent |
| OIP 0.2.x | ✅ Compatible avec adapteur legacy | ✅ Natif |

### 6.4 Contrats stables

Les éléments suivants doivent rester stables sur plusieurs versions majeures d'OIP :

- Identifiants des `capabilities` ;
- Contrats des `adapters` identifiés ;
- Structure minimale des métadonnées.

Les éléments suivants peuvent évoluer plus librement :

- Champs optionnels ;
- Sections descriptives ;
- Règles de migration internes à l'application.

---

## 7. Exemple complet

```yaml
manifestVersion: "1.0.0"

application:
  id: opays-hq
  name: Opays HQ
  description: Gestion d'entreprise IA pour PME africaines.
  repository: https://github.com/opaystech-stack/opays-hq.git

oipCompatibility:
  min: "0.1.0-alpha"
  max: "0.2.0"
  reason: Première intégration sur la baseline alpha validée.

modules:
  - id: customers
    name: Gestion des clients
    version: "2.1.0"
  - id: tasks
    name: Gestion des tâches
    version: "1.5.0"
  - id: reports
    name: Rapports
    version: "1.0.0"

services:
  - id: customer-service
    moduleId: customers
    type: http
    adapter: CustomerServiceAdapter
    endpoints:
      - path: /api/customers
        method: POST
        purpose: createCustomer

aiEntrypoints:
  - id: hq-chat
    type: chat
    description: Chat métier intégré au dashboard HQ

componentsToReplace:
  - id: legacy-nlp
    type: nlp-parser
    migrationPhase: 2

capabilities:
  - id: business.customer.create
    moduleId: customers
    description: Créer une fiche client
    parameters:
      - name: name
        type: string
        required: true
      - name: email
        type: string
        required: true
    requiredRoles:
      - sales.manager
    confirmationLevel: none
    toolHandler: createCustomer
    emits:
      - CustomerCreated

  - id: business.task.schedule
    moduleId: tasks
    description: Planifier une tâche métier
    parameters:
      - name: title
        type: string
        required: true
      - name: dueDate
        type: string
        required: true
    requiredRoles:
      - manager
    confirmationLevel: none
    toolHandler: scheduleTask
    emits:
      - TaskScheduled

adapters:
  - id: identity
    name: IdentityAdapter
  - id: business-tools
    name: BusinessToolAdapter
  - id: memory
    name: MemoryAdapter
  - id: audit
    name: AuditAdapter

featureFlags:
  - id: oip-shadow-mode
    description: Mode shadow pour HQ
    default: true
  - id: oip-customer-create
    description: Active la création de client via OIP
    default: false
    dependsOn:
      - oip-shadow-mode

migration:
  currentPhase: manifest
  phases:
    - id: analysis
      done: true
    - id: manifest
      done: true
    - id: blueprint
      done: false
    - id: shadow
      done: false
    - id: progressive
      done: false
    - id: cleanup
      done: false
```

---

## 6. Migration Backlog

Le **Migration Backlog** est un artefact complémentaire obligatoire. Il décrit le travail de migration à réaliser, construit exclusivement à partir du Manifest v1.

Le Manifest décrit l'application. Le Migration Backlog décrit le travail. Le Blueprint décrit la stratégie d'exécution. Aucun Blueprint ne peut être produit sans un Migration Backlog validé.

Voir :

- `docs/oip-migration-backlog-standard.md`
- `docs/oip-migration-state.md`
- `docs/oip-pilot-applications.md`
- `examples/opays.manifest.example.yaml`
- `examples/opays.migration-backlog.example.yaml`
---

## 7. Gouvernance et validation

### 7.1 Propriétaire du Manifest

Le Manifest appartient à l'application. OIP ne doit jamais le modifier directement.

### 7.2 Cycle de validation officiel

1. **Discovery** : analyse de la codebase.
2. **Manifest Draft** : première proposition.
3. **Manifest Architecture Review** : revue par l'équipe architecture.
4. **Manifest v1 (Approved)** : approbation formelle.
5. **Migration Backlog (Validated)** : backlog de migration validé.
6. **Migration Blueprint** : stratégie d'exécution.
7. **Shadow Mode** : exécution parallèle.
8. **Migration** : remplacement progressif.
9. **Cleanup** : suppression des composants legacy.
10. **Certified** : intégration validée officiellement.

L'état courant d'une application est matérialisé par son **Migration State**, stocké dans `migration.currentState` du Manifest. Voir `docs/oip-migration-state.md`.

### 7.3 Suivi des applications pilotes

Le Manifest évolue uniquement par pull request dans le dépôt de l'application. L'analyse automatique peut proposer un diff, mais l'approbation est humaine.

L'état réel des applications pilotes est centralisé dans `docs/oip-pilot-applications.md`. Ce document indique, pour chaque application, son Migration State actuel, ses artefacts validés et sa prochaine étape autorisée.

### 7.4 Modification du Manifest

## 8. Prochaines étapes de validation

1. Valider le schéma proposé dans une revue d'architecture.
2. Créer un JSON Schema (`opays.manifest.schema.json`) pour valider automatiquement les Manifests.
3. Produire un ADR côté OIP : `docs/adr/adr-005-integration-manifest.md`.
4. Appliquer ce contrat sur les applications pilotes suivies dans `docs/oip-pilot-applications.md`.
5. Écrire un guide d'analyse : `docs/oip-manifest-analysis-guide.md`.
6. Définir et valider le standard du Migration Backlog : `docs/oip-migration-backlog-standard.md`.

---

## 9. Points de vigilance

- Le Manifest appartient à l'application, jamais à OIP.
- **Aucun Migration Blueprint ne commence sans Manifest v1 approuvé et Migration Backlog validé.**
- Aucune logique applicative ne transite dans OIP.
- OIP reste générique ; l'application s'adapte via son Manifest et ses adaptateurs.
- Le Manifest, le Migration Backlog et le Blueprint sont complémentaires et ne doivent jamais être fusionnés.
