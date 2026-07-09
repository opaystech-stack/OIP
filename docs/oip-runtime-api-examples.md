# Exemples officiels de contrats par transport

Version : `1.0.0`  
Statut : Contrat officiel — API Readiness Program WS-6  
Date : 2026-07-09

---

## 1. Principe

Ce document fournit les **exemples officiels** de requêtes et réponses pour chaque transport supporté. Ils servent de référence unique pour l'implémentation des consommateurs.

> **Règle absolue** : un même contrat public est utilisé par tous les transports. Seul le mécanisme d'appel change.

---

## 2. Transports supportés

1. SDK local (`OipPublicClient`)
2. API HTTP (`POST /v1/oip/invoke`)
3. CLI (`oip invoke`)
4. MCP (Model Context Protocol)
5. Automation (workflow trigger + action)

---

## 3. Exemple 1 : `llm.generateText`

### 3.1 SDK

```typescript
import { OipPublicClient, buildRuntimeContextFromAuth } from "@opaystech/oip/public";

const client = OipPublicClient.create({
  runtimeContext: buildRuntimeContextFromAuth({
    userId: "user-123",
    organizationId: "org-456",
    roles: ["operator"],
    workspaceId: "ws-789",
  }),
});

const response = await client.invoke({
  requestId: "req-001",
  operation: "llm.generateText",
  payload: {
    messages: [
      { role: "system", content: "Tu es un assistant commercial." },
      { role: "user", content: "Résume la commande en cours." },
    ],
    temperature: 0.7,
    maxTokens: 250,
  },
});

// response.result
// {
//   text: "La commande ...",
//   model: "gpt-4o-mini",
//   usage: { promptTokens: 24, completionTokens: 18 }
// }
```

### 3.2 HTTP

**Requête :**

```http
POST /v1/oip/invoke HTTP/1.1
Host: oip.opays.tech
Authorization: Bearer eyJ...
Content-Type: application/json
X-Oip-Api-Version: v1

{
  "requestId": "req-001",
  "operation": "llm.generateText",
  "payload": {
    "messages": [
      { "role": "system", "content": "Tu es un assistant commercial." },
      { "role": "user", "content": "Résume la commande en cours." }
    ],
    "temperature": 0.7,
    "maxTokens": 250
  }
}
```

**Réponse :**

```json
{
  "requestId": "req-001",
  "operation": "llm.generateText",
  "status": "completed",
  "result": {
    "text": "La commande #12345 contient 3 articles...",
    "model": "gpt-4o",
    "usage": { "promptTokens": 45, "completionTokens": 32 }
  },
  "metadata": {
    "durationMs": 412,
    "version": "v1"
  }
}
```

### 3.3 CLI

```bash
oip invoke llm.generateText \
  --request-id req-001 \
  --organization org-456 \
  --workspace ws-789 \
  --user user-123 \
  --role operator \
  --payload '{"messages":[{"role":"system","content":"Tu es un assistant commercial."},{"role":"user","content":"Résume la commande en cours."}],"temperature":0.7,"maxTokens":250}'
```

### 3.4 MCP

```json
{
  "name": "llm.generateText",
  "arguments": {
    "messages": [
      { "role": "system", "content": "Tu es un assistant commercial." },
      { "role": "user", "content": "Résume la commande en cours." }
    ],
    "temperature": 0.7,
    "maxTokens": 250
  }
}
```

Le serveur MCP traduit l'appel en `POST /v1/oip/invoke`.

### 3.5 Automation

```yaml
trigger:
  type: scheduled
  cron: "0 9 * * *"

actions:
  - id: summarize-orders
    operation: llm.generateText
    payload:
      messages:
        - role: system
          content: "Tu es un assistant commercial."
        - role: user
          content: "Résume les commandes du jour."
```

---

## 4. Exemple 2 : `actions.execute` avec confirmation

### 4.1 SDK

```typescript
const plan = {
  capabilityId: "commerce.order.cancel",
  arguments: { orderId: "order-999" },
  confidence: 0.96,
  reason: "Demande explicite de l'utilisateur.",
  requiresConfirmation: true,
};

const pending = await client.invoke({
  requestId: "req-002",
  operation: "actions.execute",
  payload: { plan },
});

// pending.status === "pending-confirmation"

const confirmed = await client.invoke({
  requestId: "req-003",
  operation: "actions.confirm",
  payload: { requestId: "req-002" },
});

// confirmed.status === "completed"
```

### 4.2 HTTP

```http
POST /v1/oip/invoke HTTP/1.1
Content-Type: application/json

{
  "requestId": "req-002",
  "operation": "actions.execute",
  "payload": {
    "plan": {
      "capabilityId": "commerce.order.cancel",
      "arguments": { "orderId": "order-999" },
      "confidence": 0.96,
      "reason": "Demande explicite de l'utilisateur.",
      "requiresConfirmation": true
    }
  }
}
```

**Réponse intermédiaire :**

```json
{
  "requestId": "req-002",
  "operation": "actions.execute",
  "status": "pending-confirmation",
  "result": null,
  "error": null,
  "metadata": { "durationMs": 45, "version": "v1" }
}
```

**Confirmation :**

```http
POST /v1/oip/invoke HTTP/1.1
Content-Type: application/json

{
  "requestId": "req-003",
  "operation": "actions.confirm",
  "payload": { "requestId": "req-002" }
}
```

---

## 5. Exemple 3 : `events.subscribe`

### 5.1 SDK

```typescript
await client.invoke({
  requestId: "req-004",
  operation: "events.subscribe",
  payload: {
    subscriptionId: "sub-001",
    types: ["order.created", "payment.received"],
    delivery: "sse",
  },
});

const eventSource = new EventSource("/v1/oip/events/sse?subscriptionId=sub-001");
eventSource.onmessage = (msg) => console.log(JSON.parse(msg.data));
```

### 5.2 HTTP

```http
POST /v1/oip/invoke HTTP/1.1
Content-Type: application/json

{
  "requestId": "req-004",
  "operation": "events.subscribe",
  "payload": {
    "subscriptionId": "sub-001",
    "types": ["order.created", "payment.received"],
    "delivery": "sse"
  }
}
```

**Connexion SSE :**

```http
GET /v1/oip/events/sse?subscriptionId=sub-001 HTTP/1.1
Accept: text/event-stream
Authorization: Bearer eyJ...
```

### 5.3 Webhook

```http
POST /v1/oip/invoke HTTP/1.1
Content-Type: application/json

{
  "requestId": "req-005",
  "operation": "events.subscribe",
  "payload": {
    "subscriptionId": "sub-002",
    "types": ["invoice.generated"],
    "delivery": "webhook",
    "callback": "https://api.opays-hq.example/oip/webhook"
  }
}
```

Le webhook reçoit :

```json
{
  "event": {
    "id": "evt-001",
    "type": "invoice.generated",
    "payload": { "invoiceId": "inv-123" },
    "occurredAt": "2026-07-09T10:30:00Z"
  }
}
```

Avec l'en-tête `X-Oip-Signature`.

---

## 6. Exemple 4 : erreur publique

### 6.1 HTTP

```http
POST /v1/oip/invoke HTTP/1.1
Content-Type: application/json

{
  "requestId": "req-006",
  "operation": "actions.execute",
  "payload": {
    "plan": {
      "capabilityId": "commerce.order.cancel",
      "arguments": { "orderId": "order-999" },
      "confidence": 0.96,
      "reason": "..."
    }
  }
}
```

**Réponse :**

```json
{
  "requestId": "req-006",
  "operation": "actions.execute",
  "status": "error",
  "result": null,
  "error": {
    "code": "forbidden",
    "message": "User lacks role 'order-manager' required by capability commerce.order.cancel.",
    "details": { "capabilityId": "commerce.order.cancel", "requiredRoles": ["order-manager"] },
    "retryable": false,
    "suggestedAction": "none"
  },
  "metadata": { "durationMs": 12, "version": "v1" }
}
```

---

## 7. Table de mapping des transports

| Opération | SDK | HTTP | CLI | MCP | Automation |
|---|---|---|---|---|---|
| `llm.generateText` | `invoke()` | `POST /v1/oip/invoke` | `oip invoke` | tool | action |
| `llm.generateJson` | `invoke()` | `POST /v1/oip/invoke` | `oip invoke` | tool | action |
| `llm.embed` | `invoke()` | `POST /v1/oip/invoke` | `oip invoke` | tool | action |
| `memory.append` | `invoke()` | `POST /v1/oip/invoke` | `oip invoke` | tool | action |
| `memory.recall` | `invoke()` | `POST /v1/oip/invoke` | `oip invoke` | tool | action |
| `memory.remember` | `invoke()` | `POST /v1/oip/invoke` | `oip invoke` | tool | action |
| `events.publish` | `invoke()` | `POST /v1/oip/invoke` | `oip invoke` | tool | action |
| `events.subscribe` | `invoke()` + EventSource | `POST /v1/oip/invoke` puis SSE | `oip subscribe` | non applicable | trigger |
| `events.unsubscribe` | `invoke()` | `POST /v1/oip/invoke` | `oip unsubscribe` | non applicable | action |
| `events.list` | `invoke()` | `POST /v1/oip/invoke` | `oip list events` | tool | action |
| `context.build` | `invoke()` | `POST /v1/oip/invoke` | `oip invoke` | tool | action |
| `decision.plan` | `invoke()` | `POST /v1/oip/invoke` | `oip invoke` | tool | action |
| `decision.decide` | `invoke()` | `POST /v1/oip/invoke` | `oip invoke` | tool | action |
| `actions.execute` | `invoke()` | `POST /v1/oip/invoke` | `oip execute` | tool | action |
| `actions.confirm` | `invoke()` | `POST /v1/oip/invoke` | `oip confirm` | tool | action |
| `knowledge.search` | `invoke()` | `POST /v1/oip/invoke` | `oip invoke` | tool | action |
| `knowledge.ingest` | `invoke()` | `POST /v1/oip/invoke` | `oip ingest` | tool | action |
| `identity.authenticate` | serveur | `POST /v1/oip/invoke` | `oip auth` | non applicable | non applicable |
| `identity.resolveWorkspace` | `invoke()` | `POST /v1/oip/invoke` | `oip resolve` | tool | action |
| `policy.evaluate` | `invoke()` | `POST /v1/oip/invoke` | `oip invoke` | tool | action |
| `capabilities.list` | `invoke()` | `POST /v1/oip/invoke` | `oip list capabilities` | tool | action |
| `capabilities.describe` | `invoke()` | `POST /v1/oip/invoke` | `oip describe` | tool | action |
| `audit.list` | `invoke()` | `POST /v1/oip/invoke` | `oip audit` | tool | action |
| `traces.list` | `invoke()` | `POST /v1/oip/invoke` | `oip traces` | tool | action |

---

## 8. Références

- `docs/oip-runtime-api-public-types.md`
- `docs/oip-runtime-api-contract.md`
- `docs/oip-runtime-api-versioning.md`
- `docs/oip-runtime-api-security.md`
- `docs/oip-runtime-api-governance.md`
- `docs/adr/adr-009-runtime-public-api.md`
- `docs/oip-api-readiness-program.md`
- `docs/architecture-reviews/ar-002-api-readiness-review.md`
- MB-001 — Pre-Flight API Validation
