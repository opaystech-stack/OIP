# Types publics officiels de l'API Runtime OIP

Version : `1.0.0`  
Statut : Contrat officiel — API Readiness Program WS-1  
Date : 2026-07-09

---

## 1. Principe

Ce document définit les **types publics officiels** du contrat d'API Runtime OIP. Ces types sont la seule surface de typage accessible aux consommateurs externes. Ils sont indépendants des types internes du moteur OIP.

> **Règle absolue** : un consommateur ne peut importer que des types définis ici ou dans le catalogue d'opérations. Aucun type interne (`InMemory*Runtime`, `ActionEngine`, etc.) n'est exposé.

---

## 2. Types de base publics

### 2.1 `JsonValue`

```typescript
type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonObject
  | readonly JsonValue[];
```

### 2.2 `JsonObject`

```typescript
interface JsonObject {
  readonly [key: string]: JsonValue;
}
```

### 2.3 `JsonArray`

```typescript
type JsonArray = readonly JsonValue[];
```

Ces types sont publics, stables et figés. Ils peuvent être recopiés par les consommateurs n'utilisant pas TypeScript.

---

## 3. Contexte d'exécution public

### 3.1 `RuntimeContext`

```typescript
interface RuntimeContext {
  readonly requestId: string;
  readonly channel: RuntimeChannel;
  readonly user: UserContext;
  readonly metadata?: JsonObject;
}
```

### 3.2 `RuntimeChannel`

```typescript
type RuntimeChannel =
  | "api"
  | "web"
  | "mobile"
  | "cli"
  | "mcp"
  | "automation"
  | string;
```

Le canal est extensible : une application peut ajouter sa propre valeur sans casser le contrat.

### 3.3 `UserContext`

```typescript
interface UserContext {
  readonly userId: string;
  readonly organizationId: string;
  readonly workspaceId?: string;
  readonly roles: readonly string[];
  readonly locale?: string;
  readonly activeModule?: string;
  readonly activePage?: string;
}
```

Champ obligatoire : `userId`, `organizationId`, `roles`.  
Champs optionnels : `workspaceId`, `locale`, `activeModule`, `activePage`.

---

## 4. Types des opérations publiques

### 4.1 LLM

```typescript
interface LlmMessage {
  readonly role: "system" | "user" | "assistant";
  readonly content: string;
}

interface LlmGenerateTextPayload {
  readonly messages: readonly LlmMessage[];
  readonly temperature?: number;
  readonly maxTokens?: number;
}

interface LlmGenerateTextResult {
  readonly text: string;
  readonly model?: string;
  readonly usage?: {
    readonly promptTokens: number;
    readonly completionTokens: number;
  };
}

interface LlmGenerateJsonPayload {
  readonly messages: readonly LlmMessage[];
  readonly schema: JsonObject;
  readonly temperature?: number;
}

interface LlmGenerateJsonResult {
  readonly data: JsonObject;
}

interface LlmEmbedPayload {
  readonly text: string;
}

interface LlmEmbedResult {
  readonly embedding: readonly number[];
}
```

### 4.2 Mémoire

```typescript
interface MemoryAppendPayload {
  readonly entry: MemoryEntry;
}

interface MemoryRecallPayload {
  readonly query: MemoryQuery;
}

interface MemoryRememberPayload {
  readonly input: string;
  readonly output: string;
}

interface MemoryEntry {
  readonly id: string;
  readonly type: string;
  readonly userId: string;
  readonly workspaceId: string;
  readonly content: string;
  readonly occurredAt: string;
  readonly metadata?: JsonObject;
}

interface MemoryQuery {
  readonly workspaceId: string;
  readonly userId?: string;
  readonly types?: readonly string[];
  readonly limit?: number;
  readonly keywords?: string;
}

interface MemoryRecallResult {
  readonly results: readonly { readonly entry: MemoryEntry; readonly score: number }[];
}
```

### 4.3 Événements

```typescript
interface EventPublishPayload {
  readonly event: DomainEvent;
}

interface EventSubscribePayload {
  readonly subscriptionId: string;
  readonly types: readonly string[];
  readonly delivery: EventDeliveryMode;
  readonly callback?: string;
}

interface EventUnsubscribePayload {
  readonly subscriptionId: string;
}

interface EventListPayload {
  readonly types?: readonly string[];
  readonly since?: string;
  readonly limit?: number;
}

interface DomainEvent {
  readonly id: string;
  readonly type: string;
  readonly payload: JsonObject;
  readonly occurredAt: string;
  readonly correlationId?: string;
}

type EventDeliveryMode = "sse" | "websocket" | "webhook" | "polling";
```

### 4.4 Contexte

```typescript
interface ContextBuildPayload {
  readonly input: string;
}

interface ContextBuildResult {
  readonly runtime: RuntimeContext;
  readonly knowledge: readonly KnowledgeItem[];
  readonly memory: readonly MemoryEntry[];
  readonly metadata: JsonObject;
}

interface KnowledgeItem {
  readonly sourceId: string;
  readonly title: string;
  readonly content: string;
  readonly score: number;
  readonly metadata?: JsonObject;
}
```

### 4.5 Décision / Planification

```typescript
interface DecisionPlanPayload {
  readonly input: string;
  readonly context?: RuntimeContext;
}

interface DecisionPlanResult {
  readonly plan: PlannedAction;
  readonly confidence: number;
  readonly reason: string;
}

interface DecisionDecidePayload {
  readonly input: string;
  readonly context?: RuntimeContext;
}

interface DecisionDecideResult {
  readonly intentId?: string;
  readonly confidence: number;
  readonly reason: string;
}

interface PlannedAction {
  readonly capabilityId: string;
  readonly arguments: JsonObject;
  readonly confidence: number;
  readonly reason: string;
  readonly requiresConfirmation?: boolean;
}
```

> Distinction officielle : `decision.plan` produit un `PlannedAction` exécutable. `decision.decide` évalue l'intention et retourne une classification sans plan structuré.

### 4.6 Action

```typescript
interface ActionExecutePayload {
  readonly plan: PlannedAction;
}

interface ActionConfirmPayload {
  readonly requestId: string;
}

interface ActionResult {
  readonly status: "completed" | "rejected" | "pending-confirmation";
  readonly output?: JsonValue;
  readonly events: readonly DomainEvent[];
  readonly message?: string;
}
```

### 4.7 Knowledge

```typescript
interface KnowledgeSearchPayload {
  readonly query: string;
  readonly sourceIds?: readonly string[];
  readonly limit?: number;
}

interface KnowledgeSearchResult {
  readonly items: readonly KnowledgeItem[];
}

interface KnowledgeIngestPayload {
  readonly sourceId: string;
  readonly document: {
    readonly title: string;
    readonly text: string;
    readonly metadata?: JsonObject;
  };
}

interface KnowledgeIngestResult {
  readonly documentId: string;
  readonly chunks: number;
  readonly status: "completed" | "failed";
}
```

### 4.8 Identity

```typescript
interface IdentityAuthenticatePayload {
  readonly token: string;
  readonly headers?: JsonObject;
}

interface IdentityAuthenticateResult {
  readonly identity: UserContext;
}

interface IdentityResolveWorkspacePayload {
  readonly identity: UserContext;
}

interface IdentityResolveWorkspaceResult {
  readonly workspaceId: string;
  readonly workspaceName: string;
  readonly plugins: readonly string[];
}
```

### 4.9 Policy

```typescript
interface PolicyEvaluatePayload {
  readonly resource: string;
  readonly action: string;
  readonly context?: JsonObject;
}

interface PolicyEvaluateResult {
  readonly effect: "allow" | "deny";
  readonly reasons: readonly string[];
}
```

### 4.10 Capabilities

```typescript
interface CapabilitiesListPayload {
  readonly moduleId?: string;
}

interface CapabilitiesListResult {
  readonly capabilities: readonly CapabilityInfo[];
}

interface CapabilitiesDescribePayload {
  readonly capabilityId: string;
}

interface CapabilitiesDescribeResult {
  readonly capability: CapabilityInfo;
}

interface CapabilityInfo {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly moduleId: string;
  readonly requiredRoles: readonly string[];
  readonly confirmationLevel: "none" | "sensitive" | "critical";
  readonly parameters: readonly JsonObject[];
}
```

### 4.11 Observabilité

```typescript
interface AuditListPayload {
  readonly requestId?: string;
  readonly userId?: string;
  readonly since?: string;
  readonly limit?: number;
}

interface AuditListResult {
  readonly records: readonly AuditRecord[];
}

interface AuditRecord {
  readonly requestId: string;
  readonly operation: string;
  readonly userId: string;
  readonly organizationId: string;
  readonly status: string;
  readonly occurredAt: string;
}

interface TracesListPayload {
  readonly operation?: string;
  readonly requestId?: string;
  readonly limit?: number;
}

interface TracesListResult {
  readonly traces: readonly TraceRecord[];
}

interface TraceRecord {
  readonly operation: string;
  readonly requestId: string;
  readonly durationMs: number;
  readonly metadata?: JsonObject;
}
```

---

## 5. Enveloppes publiques

### 5.1 `OipPublicRequest<TPayload>`

```typescript
interface OipPublicRequest<TPayload = JsonObject> {
  readonly requestId: string;
  readonly operation: string;
  readonly payload: TPayload;
  readonly context?: RuntimeContext;
  readonly timeoutMs?: number;
  readonly correlationId?: string;
}
```

### 5.2 `OipPublicResponse<TResult>`

```typescript
interface OipPublicResponse<TResult = JsonObject> {
  readonly requestId: string;
  readonly operation: string;
  readonly status: "completed" | "rejected" | "pending" | "error";
  readonly result?: TResult;
  readonly error?: OipPublicError;
  readonly metadata: {
    readonly durationMs: number;
    readonly version: string;
    readonly warnings?: readonly string[];
  };
}
```

### 5.3 `OipPublicError`

```typescript
interface OipPublicError {
  readonly code: string;
  readonly message: string;
  readonly details?: JsonObject;
  readonly retryable: boolean;
  readonly suggestedAction?: "retry" | "confirm" | "escalate" | "none";
}
```

---

## 6. Règles d'évolution

- Ajouter un champ **optionnel** dans un type existant est autorisé sans nouvelle version majeure.
- Ajouter une valeur à une union de chaînes (comme `RuntimeChannel` ou `EventDeliveryMode`) est autorisé sans nouvelle version majeure.
- Modifier un champ **obligatoire** ou supprimer un champ nécessite une nouvelle version majeure.
- Renommer un type ou une opération nécessite une nouvelle version majeure.
- Les types internes OIP ne doivent jamais être exposés dans les signatures publiques.

---

## 7. Mise en œuvre

Dans l'implémentation future, ces types seront définis dans le package `packages/public-api`. Ils ne dépendront d'aucun type interne. Les types internes équivalents seront convertis par le routeur (`packages/public-api-router`) sans que le consommateur ne le sache.

---

## 8. Références

- `docs/adr/adr-009-runtime-public-api.md`
- `docs/oip-runtime-api-contract.md`
- `docs/oip-api-readiness-program.md`
- `docs/architecture-reviews/ar-002-api-readiness-review.md`
- `docs/oip-runtime-api-versioning.md`
- `docs/oip-runtime-api-security.md`
- `docs/oip-runtime-api-governance.md`
- `docs/oip-runtime-api-examples.md`
- MB-001 — Pre-Flight API Validation
