# Modèle officiel de sécurité de l'API publique OIP

Version : `1.0.0`  
Statut : Contrat officiel — API Readiness Program WS-4  
Date : 2026-07-09

---

## 1. Principe

La sécurité de l'API publique OIP repose sur la **séparation des responsabilités** :

- **Transport** : authentifie l'appelant et construit un `RuntimeContext`.
- **Facade** : reçoit le `RuntimeContext` et applique les politiques d'autorisation via `PolicyRuntime` et `Validator`.
- **Routeur** : achemine vers les Runtimes sans logique métier.
- **Runtimes** : implémentent les règles de sécurité métier.

> **Règle absolue** : le contrat public ne transporte jamais de secrets (tokens, clés API, mots de passe) dans le `RuntimeContext`.

---

## 2. Authentification

### 2.1 Modèle

L'authentification est transport-spécifique et externe à la facade. Le transport est responsable de :

- valider le token ou la clé d'identification ;
- construire un `UserContext` minimal ;
- lancer l'opération `identity.authenticate` si un enrichissement est nécessaire ;
- injecter le `RuntimeContext` dans l'appel à la facade.

### 2.2 Par transport

| Transport | Mécanisme d'authentification attendu |
|---|---|
| SDK local | L'application hôte fournit directement le `RuntimeContext`. Pas d'authentification réseau. |
| HTTP | En-tête `Authorization: Bearer <token>` ou clé API `X-Api-Key`. Le serveur HTTP valide et construit le contexte. |
| CLI | Configuration locale de l'utilisateur (fichier de credentials) ou token passé en argument. |
| MCP | Négociation initiale du serveur MCP ; contexte propagé par session. |
| Automation | Identité de service associée au workflow ; fournie par le moteur d'automation. |

### 2.3 Construction du RuntimeContext

Le `RuntimeContext` contient obligatoirement :

- `requestId`
- `channel`
- `user.userId`
- `user.organizationId`
- `user.roles`

Optionnellement :

- `user.workspaceId`
- `user.locale`
- `user.activeModule`
- `user.activePage`
- `metadata`

---

## 3. Autorisation

### 3.1 Niveaux d'autorisation

1. **Transport** : vérifie que l'appel est authentifié.
2. **PolicyRuntime** : évalue les politiques de l'organisation sur la requête.
3. **Validator** : vérifie que les rôles requis par la capability sont présents.
4. **CapabilityDefinition** : définit le niveau de confirmation requis (`none`, `sensitive`, `critical`).

### 3.2 Scopes publics

Chaque opération publique est associée à un scope machine. Les scopes sont utilisés par le `PolicyRuntime` pour des autorisations fines.

| Domaine | Scopes |
|---|---|
| LLM | `llm:read` |
| Mémoire | `memory:read`, `memory:write` |
| Événements | `events:read`, `events:write`, `events:admin` |
| Contexte | `context:read` |
| Décision | `decision:read` |
| Action | selon la capability |
| Knowledge | `knowledge:read`, `knowledge:write` |
| Identity | `identity:read` |
| Policy | `policy:read` |
| Capabilities | `capabilities:read` |
| Audit | `audit:admin` |
| Traces | `traces:admin` |

### 3.3 Rôles par défaut

Le contrat public définit des rôles par défaut. Les applications peuvent surcharger ces règles via leur `PolicyRuntime`.

| Opération | Rôle minimal par défaut |
|---|---|
| `llm.generateText` | authentifié |
| `memory.append` | authentifié |
| `events.list` | `admin` |
| `actions.execute` | selon capability |
| `knowledge.ingest` | `admin` ou `knowledge-manager` |
| `audit.list` | `admin` |

---

## 4. Rate limiting et quotas

### 4.1 Par défaut

| Ressource | Limite par défaut |
|---|---|
| Appels totaux par minute et par organisation | 10 000 |
| Appels `llm.*` par minute et par organisation | 1 000 |
| Appels `actions.execute` par minute et par utilisateur | 500 |
| Mémoire stockée par workspace | configurable |
| Événements publiés par seconde | 1 000 |

### 4.2 Configuration

Les limites sont configurables par :

- organisation (`organizationId`) ;
- utilisateur (`userId`) ;
- opération ;
- transport.

Les limites sont appliquées par le transport ou par une couche de middleware avant la facade.

### 4.3 Réponses en cas de dépassement

```json
{
  "error": {
    "code": "rate-limit.exceeded",
    "message": "Rate limit exceeded. Retry after 45 seconds.",
    "details": { "retryAfterMs": 45000 },
    "retryable": true,
    "suggestedAction": "retry"
  }
}
```

---

## 5. Audit de sécurité

### 5.1 Événements tracés

- Chaque appel à une opération publique : `requestId`, `operation`, `userId`, `organizationId`, `status`, `durationMs`.
- Chaque échec d'authentification.
- Chaque refus d'autorisation.
- Chaque action `sensitive` ou `critical` exécutée.
- Chaque opération `llm.*` avec le modèle utilisé et les tokens consommés.

### 5.2 Durée de conservation

| Type d'audit | Durée minimale |
|---|---|
| Appels API | 90 jours |
| Échecs d'authentification | 365 jours |
| Actions sensibles/critiques | 365 jours |
| Traces techniques | 30 jours |

### 5.3 Accès

- Les entrées d'audit sont accessibles via `audit.list`.
- Seuls les rôles `admin` ou `security` peuvent consulter les audits d'authentification.

---

## 6. Streaming et subscriptions

### 6.1 Événements

- `events.subscribe` avec `delivery: "sse"` ou `"websocket"` : la connexion longue est établie séparément. L'opération enregistre la subscription.
- `events.subscribe` avec `delivery: "webhook"` : l'URL `callback` doit être HTTPS et validée.
- `events.subscribe` avec `delivery: "polling"` : le client utilise `events.list`.

### 6.2 Sécurité des webhooks

- Signature des payloads avec un secret partagé.
- En-tête `X-Oip-Signature` obligatoire.
- Retry exponentiel avec jitter.
- Timeout de livraison : 30 secondes.

### 6.3 SSE / WebSocket

- Authentification de la connexion initiale.
- Heartbeat toutes les 30 secondes.
- Fermeture automatique après 5 minutes d'inactivité.

---

## 7. Chiffrement et secrets

### 7.1 En transit

- Toutes les communications HTTP/MCP/Automation doivent utiliser TLS 1.2 minimum.
- Les secrets ne transitent jamais dans le payload de la facade.

### 7.2 Au repos

- Les données de mémoire et de knowledge sont chiffrées selon la politique de l'application.
- OIP ne définit pas de mécanisme de chiffrement interne ; il dépend de l'adaptateur de stockage.

### 7.3 Gestion des secrets

- Les clés API des fournisseurs LLM sont gérées par l'application, jamais exposées via l'API publique.

---

## 8. Modèle de menaces

### 8.1 Menaces identifiées

| Menace | Opérations concernées | Mitigation |
|---|---|---|
| Prompt injection | `llm.generateText`, `llm.generateJson` | Validation du contexte, pas de données sensibles dans les prompts si possible. |
| Élévation de privilèges | `actions.execute`, `policy.evaluate` | `Validator` + `PolicyRuntime` + rôles requis. |
| Fuite de données | `memory.recall`, `knowledge.search` | Isolation par `workspaceId` et `organizationId`. |
| DDoS / abus | toutes | Rate limiting, quotas, audit. |
| Fuite de secrets | toutes | Secrets hors du contrat public. |
| Injection dans les événements | `events.publish` | Validation du schéma de l'événement. |

---

## 9. Erreurs de sécurité publiques

| Code | Description | Retryable |
|---|---|---|
| `unauthorized` | Authentification manquante ou invalide. | non |
| `forbidden` | Autorisations insuffisantes. | non |
| `rate-limit.exceeded` | Limite de débit dépassée. | oui |
| `quota.exceeded` | Quota dépassé. | non |
| `security.token-expired` | Token expiré. | non |
| `security.invalid-signature` | Signature webhook invalide. | non |

---

## 10. Références

- `docs/oip-runtime-api-public-types.md`
- `docs/oip-runtime-api-contract.md`
- `docs/oip-runtime-api-versioning.md`
- `docs/oip-runtime-api-governance.md`
- `docs/oip-runtime-api-examples.md`
- `docs/adr/adr-009-runtime-public-api.md`
- `docs/oip-api-readiness-program.md`
- `docs/architecture-reviews/ar-002-api-readiness-review.md`
- MB-001 — Pre-Flight API Validation
