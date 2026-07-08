# Opays Intelligence Platform — Cycle de vie complet d'une requête

> Version: 1.0.0  
> Statut: Validé — socle architectural  
> Date: Juillet 2026

Ce document décrit le parcours complet d'une requête utilisateur à travers OIP. Chaque étape précise : données reçues, données produites, responsabilités, erreurs possibles, Runtimes impliqués et contrats échangés.

Le flux principal est :

```text
Utilisateur
    │
    ▼
Channel Runtime
    │
    ▼
Identity Runtime
    │
    ▼
Context Runtime
    │
    ▼
LLM Runtime
    │
    ▼
Decision Runtime
    │
    ▼
Policy Runtime
    │
    ▼
Action Runtime  ←── ou Workflow Runtime
    │
    ▼
Plugin métier
    │
    ▼
Event Runtime
    │
    ▼
Memory Runtime
    │
    ▼
Skill Runtime
    │
    ▼
Channel Runtime
    │
    ▼
Utilisateur
```

---

## Étapes du cycle de vie

### Étape 0 — Émission par l'utilisateur

**Description :** l'utilisateur exprime une intention via un canal.

**Exemples :**
- "Ajoute 10 sacs de ciment."
- "Fais une facture pour Patrick."
- "Qui me doit de l'argent ?"
- "Génère le rapport du mois."

**Données reçues :** aucune côté OIP avant le canal.

**Données produites :** payload natif du canal.

**Responsabilités :** utilisateur.

---

### Étape 1 — Réception par Channel Runtime

**Description :** Channel Runtime reçoit le payload brut du canal et le normalise.

**Données reçues :**
- Payload natif (HTTP request, message WhatsApp, message Telegram, événement WebSocket, audio, etc.).
- Métadonnées du canal.

**Données produites :**
- `InboundRequest` normalisé.

```ts
interface InboundRequest {
  readonly channel: "web" | "mobile" | "whatsapp" | "telegram" | "api" | "voice";
  readonly rawPayload: unknown;
  readonly text?: string;
  readonly attachments?: Attachment[];
  readonly metadata?: JsonObject;
}
```

**Responsabilités :**
- Parser le payload natif.
- Extraire le texte ou les médias.
- Attacher les métadonnées de canal.
- Ne pas exécuter de logique métier.

**Erreurs possibles :**
- `channel_unsupported`
- `payload_malformed`
- `attachment_too_large`
- `voice_transcription_failed`

**Suivant :** Identity Runtime.

---

### Étape 2 — Authentification et scoping par Identity Runtime

**Description :** Identity Runtime authentifie l'appelant et résout le Workspace actif.

**Données reçues :**
- `InboundRequest`
- Token, session, API key, credentials du canal.

**Données produites :**
- `IdentityContext`
- `Workspace`

```ts
interface IdentityContext {
  readonly userId: string;
  readonly organizationId: string;
  readonly workspaceId: string;
  readonly roles: string[];
  readonly scopes: string[];
  readonly permissions: string[];
  readonly metadata?: JsonObject;
}

interface Workspace {
  readonly id: string;
  readonly name: string;
  readonly plugins: string[];
  readonly locale: string;
  readonly settings: WorkspaceSettings;
}
```

**Responsabilités :**
- Valider l'identité.
- Résoudre le workspace.
- Charger rôles, scopes, permissions.
- Refuser l'accès si l'identité est invalide.

**Erreurs possibles :**
- `unauthenticated`
- `workspace_not_found`
- `workspace_inactive`
- `token_expired`

**Suivant :** Context Runtime.

---

### Étape 3 — Construction du contexte par Context Runtime

**Description :** Context Runtime assemble le contexte d'exécution complet.

**Données reçues :**
- `InboundRequest`
- `IdentityContext`
- `Workspace`

**Données produites :**
- `ExecutionContext`

```ts
interface ExecutionContext {
  readonly requestId: string;
  readonly workspace: Workspace;
  readonly identity: IdentityContext;
  readonly channel: Channel;
  readonly locale: string;
  readonly memory: MemoryResult[];
  readonly knowledge: KnowledgeResult[];
  readonly metadata: JsonObject;
}
```

**Responsabilités :**
- Générer un `requestId` unique.
- Interroger Memory Runtime (mémoire conversationnelle, utilisateur).
- Interroger Knowledge Runtime (connaissances contextuelles).
- Enrichir avec la langue, le canal, le module actif.
- Ne pas prendre de décision.

**Erreurs possibles :**
- `memory_store_unavailable`
- `knowledge_store_unavailable`
- `invalid_workspace_configuration`

**Suivant :** LLM Runtime.

---

### Étape 4 — Expression de l'intention par LLM Runtime

**Description :** LLM Runtime transforme le texte utilisateur en une `Intention` structurée.

**Données reçues :**
- `ExecutionContext`
- Texte de l'utilisateur.
- Schéma de l'Intention attendue.

**Données produites :**
- `Intention`

```ts
interface Intention {
  readonly type: string;
  readonly confidence: number;
  readonly entities: Entity[];
  readonly rawText: string;
  readonly goal: string;
}

interface Entity {
  readonly name: string;
  readonly value: JsonValue;
  readonly normalized?: JsonValue;
}
```

**Responsabilités :**
- Comprendre le langage naturel.
- Extraire les entités.
- Produire une intention structurée.
- Ne jamais choisir de capability.

**Erreurs possibles :**
- `llm_unavailable`
- `llm_timeout`
- `intention_parsing_failed`
- `unsupported_language`
- `low_confidence`

**Suivant :** Decision Runtime.

---

### Étape 5 — Décision et planification par Decision Runtime

**Description :** Decision Runtime transforme l'intention en plan d'exécution.

**Données reçues :**
- `Intention`
- `ExecutionContext`

**Données produites :**
- `DecisionResult`

```ts
type DecisionResult =
  | { type: "plan"; plan: ExecutionPlan }
  | { type: "clarify"; question: string; candidates: CapabilityCandidate[] }
  | { type: "reject"; reason: string };

interface ExecutionPlan {
  readonly planId: string;
  readonly steps: ExecutionStep[];
  readonly requiresConfirmation: boolean;
  readonly explanation: string;
}

interface ExecutionStep {
  readonly stepId: string;
  readonly type: "action" | "workflow" | "skill" | "clarify";
  readonly capabilityId?: string;
  readonly workflowId?: string;
  readonly skillId?: string;
  readonly arguments: JsonObject;
  readonly dependencies: string[];
}
```

**Responsabilités :**
- Découvrir les capabilities candidates.
- Filtrer par workspace, plugins actifs, rôles.
- Scorer et sélectionner la meilleure capability.
- Construire un plan simple ou multi-étapes.
- Demander clarification si nécessaire.
- Ne pas exécuter.

**Erreurs possibles :**
- `no_matching_capability`
- `ambiguous_intention`
- `missing_required_parameter`
- `capability_not_in_workspace`
- `plan_building_failed`

**Suivant :** Policy Runtime.

---

### Étape 6 — Validation par Policy Runtime

**Description :** Policy Runtime évalue si le plan est autorisé.

**Données reçues :**
- `ExecutionPlan`
- `ExecutionContext`

**Données produites :**
- `PolicyDecision`

```ts
interface PolicyDecision {
  readonly effect: "allow" | "deny" | "confirm" | "escalate";
  readonly reasons: string[];
  readonly requiredConfirmationLevel?: "low" | "medium" | "high" | "critical";
}
```

**Responsabilités :**
- Évaluer RBAC, ABAC, conformité.
- Déterminer si confirmation est requise.
- Refuser si nécessaire.

**Erreurs possibles :**
- `policy_denied`
- `missing_permission`
- `confirmation_required`
- `escalation_required`

**Suivant :** Action Runtime (plan simple) ou Workflow Runtime (plan multi-étapes).

---

### Étape 7 — Exécution par Action Runtime

**Description :** Action Runtime exécute une capability de manière atomique.

**Données reçues :**
- `PlannedAction`
- `ExecutionContext`
- `PolicyDecision`

**Données produites :**
- `ActionResult`

```ts
interface PlannedAction {
  readonly capabilityId: string;
  readonly arguments: JsonObject;
  readonly confidence: number;
  readonly reason: string;
}

interface ActionResult {
  readonly capabilityId: string;
  readonly status: "completed" | "rejected" | "pending" | "awaiting_confirmation";
  readonly data?: JsonObject;
  readonly events: DomainEvent[];
  readonly errors?: ActionError[];
  readonly auditId: string;
}
```

**Responsabilités :**
- Valider les arguments (type, required, contraintes).
- Vérifier confirmation si exigée.
- Appeler le `ToolHandler` du plugin.
- Publier les événements sur Event Runtime.
- Journaliser sur Audit/Observability.

**Erreurs possibles :**
- `invalid_arguments`
- `capability_handler_not_found`
- `plugin_execution_failed`
- `confirmation_missing`
- `side_effect_failed`

**Suivant alternatif :** Workflow Runtime si le plan comporte plusieurs étapes.

---

### Étape 7b — Orchestration par Workflow Runtime (optionnel)

**Description :** si le plan est multi-étapes, Workflow Runtime orchestre.

**Données reçues :**
- `ExecutionPlan`
- `ExecutionContext`

**Données produites :**
- `WorkflowExecution`

```ts
interface WorkflowExecution {
  readonly executionId: string;
  readonly workflowId: string;
  readonly status: "pending" | "running" | "completed" | "failed" | "awaiting_input";
  readonly steps: WorkflowStepState[];
}
```

**Responsabilités :**
- Gérer l'état du workflow.
- Appeler Action Runtime pour chaque étape.
- Publier les événements d'état.
- Gérer compensations et reprises.

**Erreurs possibles :**
- `workflow_not_found`
- `workflow_step_failed`
- `workflow_timeout`
- `workflow_awaiting_input`

**Suivant :** Action Runtime (pour chaque étape), puis Plugin.

---

### Étape 8 — Exécution métier par le Plugin

**Description :** le plugin exécute sa logique métier via son `ToolHandler`.

**Données reçues :**
- Arguments validés.
- `ExecutionContext`.

**Données produites :**
- Résultat métier.
- Événements métier (`DomainEvent`).

```ts
interface DomainEvent {
  readonly id: string;
  readonly type: string;
  readonly payload: JsonObject;
  readonly workspaceId: string;
  readonly requestId: string;
  readonly occurredAt: string;
  readonly correlationId?: string;
}
```

**Responsabilités :**
- Exécuter la logique métier.
- Produire des événements.
- Retourner un résultat structuré.

**Erreurs possibles :**
- `business_rule_violation`
- `entity_not_found`
- `duplicate_entity`
- `external_service_failure`

**Suivant :** Event Runtime.

---

### Étape 9 — Publication d'événements par Event Runtime

**Description :** Event Runtime reçoit et distribue les événements produits.

**Données reçues :**
- `DomainEvent[]`
- `ExecutionContext`

**Données produites :**
- Abonnements notifiés.
- Projections mises à jour.

**Responsabilités :**
- Router les événements.
- Persister si nécessaire.
- Gérer les subscriptions.

**Erreurs possibles :**
- `event_publish_failed`
- `subscriber_error`

**Suivant :** Memory Runtime.

---

### Étape 10 — Mémorisation par Memory Runtime

**Description :** Memory Runtime persiste l'interaction.

**Données reçues :**
- `ExecutionContext`
- `ActionResult`
- `OutboundResponse`

**Données produites :**
- `MemoryEntry[]`

```ts
interface MemoryEntry {
  readonly id: string;
  readonly type: "conversation" | "user" | "organization" | "episodic";
  readonly workspaceId: string;
  readonly userId?: string;
  readonly content: string;
  readonly metadata?: JsonObject;
  readonly occurredAt: string;
}
```

**Responsabilités :**
- Stocker l'historique conversationnel.
- Stocker les faits importants.
- Rendre disponible pour les prochaines requêtes.

**Erreurs possibles :**
- `memory_append_failed`

**Suivant :** Skill Runtime.

---

### Étape 11 — Construction de la réponse par Skill Runtime

**Description :** Skill Runtime génère la réponse utilisateur.

**Données reçues :**
- `ExecutionContext`
- `ActionResult`
- Résultat du workflow (le cas échéant).

**Données produites :**
- `OutboundResponse`

```ts
interface OutboundResponse {
  readonly channel: Channel;
  readonly targetId: string;
  readonly messages: ResponseMessage[];
  readonly actions?: SuggestedAction[];
}
```

**Responsabilités :**
- Formatter la réponse pour le canal.
- Gérer les cas de clarification, d'erreur, de confirmation.
- Page Agent agit ici uniquement en UI Skill.

**Erreurs possibles :**
- `response_building_failed`
- `unsupported_channel_format`

**Suivant :** Channel Runtime.

---

### Étape 12 — Retour à l'utilisateur par Channel Runtime

**Description :** Channel Runtime adapte la réponse au canal natif et la délivre.

**Données reçues :**
- `OutboundResponse`

**Données produites :**
- Payload natif du canal.

**Responsabilités :**
- Adapter le format (texte, boutons, audio).
- Envoyer au destinataire.
- Tracer la livraison.

**Erreurs possibles :**
- `channel_send_failed`
- `recipient_unreachable`

---

## Cas alternatifs

### Cas A — Clarification

Si Decision Runtime retourne `DecisionResult.type === "clarify"` :

```textnDecision Runtime → Skill Runtime (ClarificationSkill) → Channel Runtime → Utilisateur
Utilisateur répond → Channel Runtime → Identity → Context → Decision Runtime (relance)
```

### Cas B — Confirmation requise

Si Policy Runtime retourne `effect === "confirm"` :

```textnPolicy Runtime → Skill Runtime (ResponseBuilderSkill) → Channel Runtime → Utilisateur
Utilisateur confirme → Channel Runtime → Decision Runtime (avec flag de confirmation)
→ Policy Runtime → Action Runtime → Plugin
```

### Cas C — Événement déclenché

Si un événement externe déclenche une action :

```textnSource externe → Event Runtime → Decision Runtime → Policy → Action/Workflow → Plugin → Event Runtime
```

### Cas D — Erreur métier

Si le plugin retourne une erreur :

```textnPlugin → Action Runtime → Event Runtime (éventuellement) → Skill Runtime (FallbackSkill) → Channel Runtime
```

---

## Tableau récapitulatif

| Étape | Runtime | Données reçues | Données produites | Erreurs principales |
|-------|---------|----------------|-------------------|---------------------|
| 0 | Utilisateur | — | Payload natif | — |
| 1 | Channel | Payload natif | `InboundRequest` | `payload_malformed`, `channel_unsupported` |
| 2 | Identity | `InboundRequest` | `IdentityContext`, `Workspace` | `unauthenticated`, `workspace_not_found` |
| 3 | Context | `InboundRequest`, identité | `ExecutionContext` | `memory_unavailable`, `knowledge_unavailable` |
| 4 | LLM | Texte, contexte | `Intention` | `llm_unavailable`, `low_confidence` |
| 5 | Decision | `Intention`, contexte | `DecisionResult` | `no_matching_capability`, `ambiguous_intention` |
| 6 | Policy | `ExecutionPlan`, contexte | `PolicyDecision` | `policy_denied`, `confirmation_required` |
| 7 | Action | `PlannedAction`, contexte | `ActionResult` | `invalid_arguments`, `plugin_execution_failed` |
| 7b | Workflow | `ExecutionPlan`, contexte | `WorkflowExecution` | `workflow_step_failed`, `workflow_timeout` |
| 8 | Plugin | Arguments, contexte | `DomainEvent[]`, résultat | `business_rule_violation`, `entity_not_found` |
| 9 | Event | `DomainEvent[]` | Notifications, projections | `event_publish_failed` |
| 10 | Memory | Contexte, résultat | `MemoryEntry[]` | `memory_append_failed` |
| 11 | Skill | Contexte, résultat | `OutboundResponse` | `response_building_failed` |
| 12 | Channel | `OutboundResponse` | Payload natif | `channel_send_failed` |

---

## Anti-patterns de flux interdits

1. **Channel appelle Decision ou Action.** → Passer par Identity et Context.
2. **LLM choisit directement une capability.** → Produire une Intention.
3. **Decision exécute une capability.** → Produire un plan.
4. **Workflow appelle un ToolHandler directement.** → Passer par Action Runtime.
5. **Action planifie des étapes.** → Action est atomique.
6. **Plugin appelle un autre plugin.** → Passer par Event Runtime ou Action Runtime.
7. **Knowledge modifie des sources métier.** → Lecture seule.

---

> Document consolidé. Aucun flux additionnel n'a été introduit.
