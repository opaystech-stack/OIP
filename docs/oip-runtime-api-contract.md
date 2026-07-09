# Contrat officiel des opérations publiques de l'API Runtime OIP

Version : `1.0.0`  
Statut : Contrat officiel — API Readiness Program WS-2  
Date : 2026-07-09

---

## 1. Principe

Ce document est le **contrat officiel** des opérations publiques de l'API Runtime OIP. Il définit l'identifiant, la charge utile, le résultat, les erreurs, la sécurité et la stabilité de chaque opération.

> **Règle absolue** : l'API publique expose uniquement les opérations listées ici. Aucune autre opération n'est publique.

---

## 2. Facade publique

Toutes les opérations sont exposées via une unique méthode de la facade :

```typescript
interface OipPublicRuntimeApi {
  invoke<TResult = JsonObject>(
    request: OipPublicRequest<JsonObject>,
  ): Promise<OipPublicResponse<TResult>>;
}
```

Le champ `operation` de la requête détermine l'opération appelée.

---

## 3. Catalogue officiel des opérations

### 3.1 Domaine LLM

| Opération | Identifiant | Stabilité |
|---|---|---|
| Générer du texte | `llm.generateText` | stable |
| Générer du JSON | `llm.generateJson` | stable |
| Produire un embedding | `llm.embed` | stable |

#### `llm.generateText`

- **Entrée :** `LlmGenerateTextPayload`
- **Sortie :** `LlmGenerateTextResult`
- **Description :** Génère du texte à partir d'une liste de messages.
- **Usage typique :** Shadow Mode, chat, synthèse.

#### `llm.generateJson`

- **Entrée :** `LlmGenerateJsonPayload`
- **Sortie :** `LlmGenerateJsonResult`
- **Description :** Génère une structure JSON conforme à un schéma.
- **Usage typique :** Planification, extraction.

#### `llm.embed`

- **Entrée :** `LlmEmbedPayload`
- **Sortie :** `LlmEmbedResult`
- **Description :** Retourne le vecteur d'embedding d'un texte.
- **Usage typique :** Recherche sémantique.

---

### 3.2 Domaine Mémoire

| Opération | Identifiant | Stabilité |
|---|---|---|
| Ajouter une entrée | `memory.append` | stable |
| Rechercher | `memory.recall` | stable |
| Mémoriser un échange | `memory.remember` | stable |

#### `memory.append`

- **Entrée :** `MemoryAppendPayload`
- **Sortie :** `void`
- **Description :** Stocke une entrée de mémoire.

#### `memory.recall`

- **Entrée :** `MemoryRecallPayload`
- **Sortie :** `MemoryRecallResult`
- **Description :** Recherche dans la mémoire par workspace, utilisateur, type ou mot-clé.

#### `memory.remember`

- **Entrée :** `MemoryRememberPayload`
- **Sortie :** `void`
- **Description :** Mémorise un échange conversationnel simplifié.

---

### 3.3 Domaine Événements

| Opération | Identifiant | Stabilité |
|---|---|---|
| Publier | `events.publish` | stable |
| S'abonner | `events.subscribe` | stable |
| Se désabonner | `events.unsubscribe` | stable |
| Lister | `events.list` | stable |

#### `events.publish`

- **Entrée :** `EventPublishPayload`
- **Sortie :** `void`
- **Description :** Publie un événement dans le bus.

#### `events.subscribe`

- **Entrée :** `EventSubscribePayload`
- **Sortie :** `void`
- **Description :** Crée une subscription à un ou plusieurs types d'événements.
- **Modèle de livraison :** défini par le champ `delivery` (`sse`, `websocket`, `webhook`, `polling`).
- **Règles :**
  - `sse` ou `websocket` : la connexion de transport est établie séparément ; cette opération enregistre la subscription.
  - `webhook` : le champ `callback` doit contenir une URL HTTPS.
  - `polling` : le client appelle `events.list` pour récupérer les événements.

#### `events.unsubscribe`

- **Entrée :** `EventUnsubscribePayload`
- **Sortie :** `void`
- **Description :** Supprime une subscription existante.

#### `events.list`

- **Entrée :** `EventListPayload`
- **Sortie :** liste de `DomainEvent`
- **Description :** Liste les événements passés (admin/observabilité).

---

### 3.4 Domaine Contexte

| Opération | Identifiant | Stabilité |
|---|---|---|
| Construire le contexte | `context.build` | stable |

#### `context.build`

- **Entrée :** `ContextBuildPayload`
- **Sortie :** `ContextBuildResult`
- **Description :** Construit le contexte d'exécution (knowledge, mémoire, métadonnées) à partir d'une entrée utilisateur.

---

### 3.5 Domaine Décision

| Opération | Identifiant | Stabilité |
|---|---|---|
| Planifier | `decision.plan` | stable |
| Classifier | `decision.decide` | stable |

#### `decision.plan`

- **Entrée :** `DecisionPlanPayload`
- **Sortie :** `DecisionPlanResult`
- **Description :** Produit un `PlannedAction` exécutable à partir d'une intention en langage naturel.
- **Différence avec `decide` :** retourne un plan complet avec `capabilityId`, `arguments`, `confidence`, `reason`.

#### `decision.decide`

- **Entrée :** `DecisionDecidePayload`
- **Sortie :** `DecisionDecideResult`
- **Description :** Évalue une intention et retourne une classification (intentId, confidence, reason) **sans** produire de plan structuré.
- **Usage typique :** Shadow Mode, routing simple.

---

### 3.6 Domaine Action

| Opération | Identifiant | Stabilité |
|---|---|---|
| Exécuter | `actions.execute` | stable |
| Confirmer | `actions.confirm` | stable |

#### `actions.execute`

- **Entrée :** `ActionExecutePayload`
- **Sortie :** `ActionResult`
- **Description :** Exécute un `PlannedAction`.
- **Confirmation :** si le plan est marqué `requiresConfirmation: true`, l'opération retourne `status: "pending-confirmation"`. L'utilisateur doit ensuite appeler `actions.confirm` avec le `requestId`.

#### `actions.confirm`

- **Entrée :** `ActionConfirmPayload`
- **Sortie :** `ActionResult`
- **Description :** Confirme une action précédemment mise en attente.

---

### 3.7 Domaine Knowledge

| Opération | Identifiant | Stabilité |
|---|---|---|
| Rechercher | `knowledge.search` | stable |
| Ingérer | `knowledge.ingest` | stable |

#### `knowledge.search`

- **Entrée :** `KnowledgeSearchPayload`
- **Sortie :** `KnowledgeSearchResult`
- **Description :** Recherche hybride (lexicale + sémantique) dans les sources de connaissance.

#### `knowledge.ingest`

- **Entrée :** `KnowledgeIngestPayload`
- **Sortie :** `KnowledgeIngestResult`
- **Description :** Ingère un document dans une source de connaissance.
- **Différence avec documents :** `knowledge.ingest` est l'opération publique. Le service `documents` interne n'est pas exposé publiquement.

---

### 3.8 Domaine Identity

| Opération | Identifiant | Stabilité |
|---|---|---|
| Authentifier | `identity.authenticate` | stable |
| Résoudre l'espace de travail | `identity.resolveWorkspace` | stable |

#### `identity.authenticate`

- **Entrée :** `IdentityAuthenticatePayload`
- **Sortie :** `IdentityAuthenticateResult`
- **Description :** Authentifie une requête et retourne un `UserContext`.
- **Transport :** principalement utilisé côté serveur HTTP ou SDK initialisé par un administrateur.

#### `identity.resolveWorkspace`

- **Entrée :** `IdentityResolveWorkspacePayload`
- **Sortie :** `IdentityResolveWorkspaceResult`
- **Description :** Résout l'espace de travail d'un utilisateur authentifié.

---

### 3.9 Domaine Policy

| Opération | Identifiant | Stabilité |
|---|---|---|
| Évaluer | `policy.evaluate` | stable |

#### `policy.evaluate`

- **Entrée :** `PolicyEvaluatePayload`
- **Sortie :** `PolicyEvaluateResult`
- **Description :** Évalue une requête contre les politiques de l'organisation.

---

### 3.10 Domaine Capabilities

| Opération | Identifiant | Stabilité |
|---|---|---|
| Lister | `capabilities.list` | stable |
| Décrire | `capabilities.describe` | stable |

#### `capabilities.list`

- **Entrée :** `CapabilitiesListPayload`
- **Sortie :** `CapabilitiesListResult`
- **Description :** Liste les capabilities accessibles dans le Runtime.

#### `capabilities.describe`

- **Entrée :** `CapabilitiesDescribePayload`
- **Sortie :** `CapabilitiesDescribeResult`
- **Description :** Retourne la description complète d'une capability.

---

### 3.11 Domaine Observabilité

| Opération | Identifiant | Stabilité |
|---|---|---|
| Lister l'audit | `audit.list` | stable |
| Lister les traces | `traces.list` | stable |

#### `audit.list`

- **Entrée :** `AuditListPayload`
- **Sortie :** `AuditListResult`
- **Description :** Liste les entrées d'audit.
- **Restriction :** opération réservée aux rôles administrateurs.

#### `traces.list`

- **Entrée :** `TracesListPayload`
- **Sortie :** `TracesListResult`
- **Description :** Liste les traces techniques.
- **Restriction :** opération réservée aux rôles administrateurs ou support.

---

## 4. Erreurs publiques par opération

Chaque opération peut retourner les erreurs génériques suivantes :

| Code | Description | Retryable |
|---|---|---|
| `unauthorized` | L'utilisateur n'est pas authentifié. | non |
| `forbidden` | L'utilisateur n'a pas les rôles requis. | non |
| `operation.not-found` | L'opération demandée n'existe pas. | non |
| `request.invalid` | Le payload est invalide. | non |
| `timeout` | L'opération a dépassé le timeout. | oui |
| `internal-error` | Erreur interne non spécifiée. | oui |

Les opérations spécifiques peuvent retourner des erreurs additionnelles documentées dans `docs/oip-runtime-api-examples.md`.

---

## 5. Matrice de sécurité par opération

| Opération | Rôles requis par défaut | Scope requis | Confirmation |
|---|---|---|---|
| `llm.generateText` | aucun | `llm:read` | non |
| `llm.generateJson` | aucun | `llm:read` | non |
| `llm.embed` | aucun | `llm:read` | non |
| `memory.append` | authentifié | `memory:write` | non |
| `memory.recall` | authentifié | `memory:read` | non |
| `memory.remember` | authentifié | `memory:write` | non |
| `events.publish` | authentifié | `events:write` | non |
| `events.subscribe` | authentifié | `events:read` | non |
| `events.unsubscribe` | authentifié | `events:write` | non |
| `events.list` | `admin` | `events:admin` | non |
| `context.build` | authentifié | `context:read` | non |
| `decision.plan` | authentifié | `decision:read` | non |
| `decision.decide` | authentifié | `decision:read` | non |
| `actions.execute` | selon capability | selon capability | selon capability |
| `actions.confirm` | selon capability | selon capability | selon capability |
| `knowledge.search` | authentifié | `knowledge:read` | non |
| `knowledge.ingest` | `admin` ou `knowledge-manager` | `knowledge:write` | non |
| `identity.authenticate` | aucun (transport) | `identity:read` | non |
| `identity.resolveWorkspace` | authentifié | `identity:read` | non |
| `policy.evaluate` | authentifié | `policy:read` | non |
| `capabilities.list` | authentifié | `capabilities:read` | non |
| `capabilities.describe` | authentifié | `capabilities:read` | non |
| `audit.list` | `admin` | `audit:admin` | non |
| `traces.list` | `admin` ou `support` | `traces:admin` | non |

> Les rôles et scopes par défaut peuvent être surchargés par le `PolicyRuntime` de l'application.

---

## 6. Versionnement des opérations

Chaque opération est officiellement introduite dans `v1`. Sa version minimale est documentée dans le catalogue. Toute modification de signature nécessitera une nouvelle version majeure du contrat public.

---

## 7. Références

- `docs/oip-runtime-api-public-types.md`
- `docs/oip-runtime-api-versioning.md`
- `docs/oip-runtime-api-security.md`
- `docs/oip-runtime-api-governance.md`
- `docs/oip-runtime-api-examples.md`
- `docs/adr/adr-009-runtime-public-api.md`
- `docs/oip-api-readiness-program.md`
- `docs/architecture-reviews/ar-002-api-readiness-review.md`
- MB-001 — Pre-Flight API Validation
