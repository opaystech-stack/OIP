# Contrat d'API publique des Runtime OIP

Version : `1.0.0-draft`  
Statut : Proposition architecturale  
Date : 2026-07-09

---

## 1. Principe fondamental

L'API publique d'OIP expose des **opérations** stables et versionnées, pas des **Runtimes** concrets. Les Runtimes restent des abstractions internes. Les consommateurs (applications, SDK, CLI, MCP, automations) interagissent avec une facade publique unique.

---

## 2. Facade publique : `OipPublicRuntimeApi`

La facade est un contrat TypeScript abstrait. Toute implémentation (SDK local, client HTTP, serveur HTTP, MCP server) doit satisfaire ce contrat.

### 2.1 Requête générique

```typescript
interface OipPublicRequest<TPayload = JsonObject> {
  readonly requestId: string;           // UUID fourni par le client, propagé
  readonly operation: string;           // identifiant d'opération (ex: "llm.generateText")
  readonly payload: TPayload;          // paramètres spécifiques à l'opération
  readonly context?: RuntimeContext;    // contexte utilisateur/organisation optionnel
  readonly timeoutMs?: number;         // timeout spécifique, sinon timeout par défaut
  readonly correlationId?: string;      // pour traçabilité cross-service
}
```

### 2.2 Réponse générique

```typescript
interface OipPublicResponse<TResult = JsonObject> {
  readonly requestId: string;
  readonly operation: string;
  readonly status: "completed" | "rejected" | "pending" | "error";
  readonly result?: TResult;
  readonly error?: OipPublicError;
  readonly metadata: {
    readonly durationMs: number;
    readonly version: string;          // version du contrat public (ex: "v1")
    readonly warnings?: readonly string[];
  };
}
```

### 2.3 Erreur publique

```typescript
interface OipPublicError {
  readonly code: string;                // code machine stable (ex: "capability.not-found")
  readonly message: string;             // message humain
  readonly details?: JsonObject;       // informations complémentaires
  readonly retryable: boolean;
  readonly suggestedAction?: string;   // ex: "retry", "confirm", "escalate"
}
```

---

## 3. Opérations publiques par domaine

### 3.1 LLM

| Opération | Description | Cas d'usage |
|---|---|---|
| `llm.generateText` | Génération de texte brut | Shadow Mode, chat, synthèse |
| `llm.generateJson` | Génération structurée | Planification, extraction |
| `llm.embed` | Embedding d'un texte | Recherche sémantique |

### 3.2 Mémoire

| Opération | Description |
|---|---|
| `memory.append` | Stocker une entrée |
| `memory.recall` | Rechercher dans la mémoire |
| `memory.remember` | Mémoriser un échange conversationnel |

### 3.3 Événements

| Opération | Description |
|---|---|
| `events.publish` | Publier un événement |
| `events.subscribe` | S'abonner à un type d'événement |
| `events.list` | Lister les événements (admin) |

### 3.4 Contexte

| Opération | Description |
|---|---|
| `context.build` | Construire le contexte d'exécution |

### 3.5 Décision / Planification

| Opération | Description |
|---|---|
| `decision.plan` | Proposer un plan d'action à partir d'une intention |
| `decision.decide` | Évaluer une intention sans exécuter |

### 3.6 Action

| Opération | Description |
|---|---|
| `actions.execute` | Exécuter une action planifiée |
| `actions.confirm` | Confirmer une action en attente |

### 3.7 Knowledge

| Opération | Description |
|---|---|
| `knowledge.search` | Recherche hybride dans les sources |
| `knowledge.ingest` | Ingérer un document |

### 3.8 Identity

| Opération | Description |
|---|---|
| `identity.authenticate` | Authentifier une requête |
| `identity.resolveWorkspace` | Résoudre l'espace de travail |

### 3.9 Policy

| Opération | Description |
|---|---|
| `policy.evaluate` | Évaluer une requête contre les politiques |

### 3.10 Capabilities

| Opération | Description |
|---|---|
| `capabilities.list` | Lister les capabilities disponibles |
| `capabilities.describe` | Décrire une capability |

### 3.11 Observabilité

| Opération | Description |
|---|---|
| `audit.list` | Lister les traces d'audit |
| `traces.list` | Lister les traces techniques |

---

## 4. Authentification

### 4.1 Modèle

La facade ne définit pas le mécanisme d'authentification. Elle reçoit un `RuntimeContext` contenant l'identité. L'authentification est réalisée **avant** l'appel à la facade, par un adaptateur `IdentityRuntime` injecté côté serveur ou SDK.

### 4.2 Règles

- Toute opération reçoit un `RuntimeContext`.
- L'identité contient `userId`, `organizationId`, `roles`, `workspaceId`.
- Les rôles sont utilisés par `PolicyRuntime` et `Validator` pour autoriser/refuser.
- Aucune clé API ou token n'est défini dans le contrat public ; ils sont transport-spécifiques.

---

## 5. Versionnement

### 5.1 Version globale

Le contrat public est versionné globalement : `v1`, `v2`, etc.

- Une opération ajoutée dans `v1.x` ne casse `v1`.
- Une opération supprimée nécessite `v2`.
- Une modification de schéma d'entrée/sortie nécessite une nouvelle version.

### 5.2 Version des opérations

Chaque opération expose sa version minimale supportée :

```typescript
interface OipOperationDefinition {
  readonly id: string;
  readonly since: string;        // "v1"
  readonly deprecated?: string;  // "v2"
  readonly removed?: string;     // "v3"
}
```

---

## 6. Timeouts

- Timeout par défaut : 30 s.
- Timeout configurable par opération dans la facade.
- Opérations longues (LLM, ingestion massive) supportent un timeout jusqu'à 5 min.
- `timeoutMs` dans la requête prime sur la valeur par défaut.

---

## 7. Stabilité et compatibilité

### 7.1 Promesse de stabilité

Une opération marquée `stable` dans `v1` conserve sa signature pendant toute la durée de vie de `v1`.

### 7.2 Champs optionnels

Les réponses ajoutent des champs optionnels sans casser la compatibilité.

### 7.3 Enumérations

Les énumérations publiques sont extensibles : ajouter une valeur ne casse pas les clients existants.

---

## 8. Expositions possibles de la facade

### 8.1 SDK local

```typescript
import { OipPublicClient } from "@opaystech/oip";

const client = OipPublicClient.fromRuntime(runtime);
const response = await client.invoke({
  operation: "llm.generateText",
  payload: { messages: [{ role: "user", content: "..." }] },
  requestId: crypto.randomUUID(),
});
```

### 8.2 API HTTP unique

```text
POST /v1/oip/invoke
Content-Type: application/json
X-Request-Id: {requestId}

{
  "operation": "llm.generateText",
  "payload": { "messages": [...] }
}
```

### 8.3 MCP / Automation

La facade peut être exposée via un serveur MCP qui mappe chaque opération sur un `tool/mcp`. Les mêmes opérations servent les automations.

---

## 9. Séparation avec le Manifest

Le Manifest de l'application indique :

- quelles opérations sont activées ;
- quels rôles sont requis ;
- quels feature flags contrôlent la disponibilité.

La facade lit ces informations mais ne les expose pas directement. Le contrat public reste indépendant du contenu d'un Manifest particulier.

---

## 10. Références

- `docs/oip-runtime-api-audit.md`
- `docs/oip-runtime-api-comparison.md`
- `docs/adr/adr-009-runtime-public-api.md`
- `packages/core/src/contracts/index.ts`
- MB-001 — Pre-Flight API Validation
