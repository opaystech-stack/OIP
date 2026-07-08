# Opays Intelligence Platform — Runtimes Reference

> Version: 1.0.0  
> Statut: Conceptuel  
> Date: Juillet 2026

Ce document est le compagnon technique de `oip-conceptual-architecture-v2.md`. Il détaille chaque Runtime de la plateforme : responsabilité, contrat public, dépendances, implémentations attendues et critères de remplacement.

---

## Index des Runtimes

1. [Channel Runtime](#1-channel-runtime)
2. [Identity Runtime](#2-identity-runtime)
3. [Context Runtime](#3-context-runtime)
4. [LLM Runtime](#4-llm-runtime)
5. [Decision Runtime](#5-decision-runtime)
6. [Policy Runtime](#6-policy-runtime)
7. [Workflow Runtime](#7-workflow-runtime)
8. [Action Runtime](#8-action-runtime)
9. [Memory Runtime](#9-memory-runtime)
10. [Knowledge Runtime](#10-knowledge-runtime)
11. [Event Runtime](#11-event-runtime)
12. [Skill Runtime](#12-skill-runtime)
13. [Observability Runtime](#13-observability-runtime)
14. [Automation Runtime](#14-automation-runtime)
15. [MCP Runtime](#15-mcp-runtime)

---

## 1. Channel Runtime

### Responsabilité

Channel Runtime est la frontière entre les interfaces utilisateur et OIP. Il transforme tout message entrant en `InboundRequest` normalisé, et route toute réponse du moteur vers le canal d'origine.

### Contrat public

```ts
interface ChannelRuntime {
  receive(channel: Channel, payload: ChannelPayload): Promise<InboundRequest>;
  send(channel: Channel, response: OutboundResponse): Promise<void>;
  supports(channel: Channel): boolean;
}

interface InboundRequest {
  readonly channel: Channel;
  readonly rawPayload: unknown;
  readonly text?: string;
  readonly attachments?: Attachment[];
  readonly metadata?: JsonObject;
}

interface OutboundResponse {
  readonly channel: Channel;
  readonly targetId: string;          // ex: sessionId, phone number, userId
  readonly messages: ResponseMessage[];
  readonly actions?: SuggestedAction[];
}
```

### Dépendances

- Aucune dépendance vers d'autres Runtimes.
- Produits : `InboundRequest`.

### Implémentations attendues

- `WebChannelAdapter`
- `MobileChannelAdapter` (Expo)
- `WhatsAppChannelAdapter`
- `TelegramChannelAdapter`
- `ApiChannelAdapter`
- `VoiceChannelAdapter`

### Critères de remplacement

Un channel peut être ajouté ou remplacé sans impacter le reste tant que le contrat `InboundRequest` / `OutboundResponse` est respecté.

---

## 2. Identity Runtime

### Responsabilité

Identity Runtime authentifie tout appelant, résout le Workspace actif, et fournit un contexte d'identité complet.

### Contrat public

```ts
interface IdentityRuntime {
  authenticate(request: InboundRequest): Promise<IdentityContext>;
  resolveWorkspace(identity: IdentityContext): Promise<Workspace>;
  authorize(identity: IdentityContext, resource: string, action: string): Promise<AuthorizationResult>;
  listPermissions(identity: IdentityContext): Promise<string[]>;
}

interface IdentityContext {
  readonly userId: string;
  readonly organizationId: string;
  readonly workspaceId: string;
  readonly roles: string[];
  readonly scopes: string[];
  readonly permissions: string[];
  readonly metadata?: JsonObject;
}
```

### Dépendances

- Aucune dépendance vers d'autres Runtimes.
- Consommateur : Context Runtime, Decision Runtime, Policy Runtime.

### Implémentations attendues

- `JwtIdentityAdapter`
- `SsoIdentityAdapter`
- `ApiKeyIdentityAdapter`
- `AnonymousIdentityAdapter` (pour démo / onboarding limité)

---

## 3. Context Runtime

### Responsabilité

Context Runtime assemble le contexte d'exécution avant que le Decision Runtime ne travaille. Il enrichit l'identité avec mémoire, connaissances et métadonnées de session.

### Contrat public

```ts
interface ContextRuntime {
  build(request: InboundRequest, identity: IdentityContext): Promise<ExecutionContext>;
}

interface ExecutionContext {
  readonly requestId: string;
  readonly workspace: Workspace;
  readonly identity: IdentityContext;
  readonly channel: Channel;
  readonly locale: string;
  readonly memory: MemoryResult[];
  readonly knowledge: KnowledgeResult[];
  readonly activePlugins: string[];
  readonly metadata: JsonObject;
}
```

### Dépendances

- Memory Runtime (historique)
- Knowledge Runtime (connaissances contextuelles)
- Identity Runtime (contexte d'identité)

### Implémentations attendues

- `DefaultContextRuntime`
- `StreamingContextRuntime` (contexte incrémental pour voice)
- `MinimalContextRuntime` (mode offline / edge)

---

## 4. LLM Runtime

### Responsabilité

LLM Runtime est le seul Runtime autorisé à appeler des modèles de fondation. Il génère du texte, du JSON structuré et des embeddings, sans jamais prendre de décision métier.

### Contrat public

```ts
interface LlmRuntime {
  generateText(request: LlmRequest): Promise<LlmResponse>;
  generateJson<T>(request: LlmRequest, schema: JsonSchema): Promise<T>;
  embed(text: string): Promise<readonly number[]>;
  listModels(): Promise<LlmModel[]>;
}

interface LlmRequest {
  readonly messages: LlmMessage[];
  readonly temperature?: number;
  readonly maxTokens?: number;
  readonly model?: string;
  readonly metadata?: JsonObject;
}
```

### Dépendances

- Aucune.

### Implémentations attendues

- `OpenAiCompatibleLlmRuntime`
- `OpenRouterLlmRuntime`
- `OllamaLlmRuntime`
- `AnthropicLlmRuntime`
- `MockLlmRuntime` (tests)

---

## 5. Decision Runtime

### Responsabilité

Decision Runtime est le cerveau opérationnel de OIP. Il transforme une `Intention` en `ExecutionPlan`. Il gère la discovery, le scoring, la sélection, la planification et la clarification.

### Contrat public

```ts
interface DecisionRuntime {
  decide(intent: Intention, context: ExecutionContext): Promise<DecisionResult>;
  explain(plan: ExecutionPlan): Promise<string>;
}

interface Intention {
  readonly type: string;
  readonly goal: string;
  readonly entities: Entity[];
  readonly confidence: number;
  readonly rawText: string;
}

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
  readonly type: "action" | "workflow" | "skill";
  readonly capabilityId?: string;
  readonly workflowId?: string;
  readonly skillId?: string;
  readonly arguments: JsonObject;
  readonly dependencies: string[];
}
```

### Dépendances

- Context Runtime (contexte)
- LLM Runtime (génération d'intention ou ranking)
- Memory Runtime (patterns historiques)
- Knowledge Runtime (connaissances de planification)
- Policy Runtime (contraintes de sélection)

### Implémentations attendues

- `LlmBasedDecisionRuntime` (par défaut)
- `RuleBasedDecisionRuntime` (fallback offline)
- `HybridDecisionRuntime` (LLM + règles)

---

## 6. Policy Runtime

### Responsabilité

Policy Runtime évalue toutes les règles de gouvernance : RBAC, ABAC, conformité, règles métier, consentement.

### Contrat public

```ts
interface PolicyRuntime {
  evaluate(request: PolicyRequest, context: ExecutionContext): Promise<PolicyDecision>;
  registerPolicy(policy: PolicyDefinition): Promise<void>;
}

interface PolicyRequest {
  readonly subject: IdentityContext;
  readonly resource: string;
  readonly action: string;
  readonly arguments?: JsonObject;
}

interface PolicyDecision {
  readonly effect: "allow" | "deny" | "confirm" | "escalate";
  readonly reasons: string[];
  readonly requiredConfirmationLevel?: "low" | "medium" | "high" | "critical";
}
```

### Dépendances

- Identity Runtime (contexte d'identité)

### Implémentations attendues

- `DeclarativePolicyRuntime` (YAML/JSON rules)
- `OpaPolicyRuntime` (Open Policy Agent)
- `HybridPolicyRuntime`

---

## 7. Workflow Runtime

### Responsabilité

Workflow Runtime orchestre des processus métier multi-étapes, avec état, transitions, compensations et human-in-the-loop.

### Contrat public

```ts
interface WorkflowRuntime {
  start(workflowId: string, args: JsonObject, context: ExecutionContext): Promise<WorkflowExecution>;
  signal(executionId: string, signal: WorkflowSignal): Promise<void>;
  getState(executionId: string): Promise<WorkflowState>;
  listDefinitions(context: ExecutionContext): Promise<WorkflowDefinition[]>;
}

interface WorkflowExecution {
  readonly executionId: string;
  readonly workflowId: string;
  readonly status: "pending" | "running" | "completed" | "failed" | "awaiting_input";
  readonly steps: WorkflowStepState[];
}
```

### Dépendances

- Action Runtime (exécution des étapes)
- Event Runtime (publication d'état)
- Policy Runtime (validation des transitions)

### Implémentations attendues

- `LangGraphWorkflowRuntime` (default cloud)
- `TemporalWorkflowRuntime` (entreprise)
- `N8nWorkflowRuntime` (automatisation externe)
- `InMemoryWorkflowRuntime` (tests)

### Point clé

LangGraph n'est qu'une implémentation. Le contrat `WorkflowRuntime` reste stable quelle que soit la technologie.

---

## 8. Action Runtime

### Responsabilité

Action Runtime est le seul Runtime autorisé à exécuter une capability métier. Il valide, gouverne, exécute, publie et journalise.

### Contrat public

```ts
interface ActionRuntime {
  execute(action: PlannedAction, context: ExecutionContext): Promise<ActionResult>;
  dryRun(action: PlannedAction, context: ExecutionContext): Promise<DryRunResult>;
}

interface PlannedAction {
  readonly capabilityId: string;
  readonly arguments: JsonObject;
  readonly reason: string;
  readonly confidence: number;
}

interface ActionResult {
  readonly capabilityId: string;
  readonly status: "completed" | "rejected";
  readonly data?: JsonObject;
  readonly events: DomainEvent[];
  readonly auditId: string;
}
```

### Dépendances

- Policy Runtime (autorisation)
- Event Runtime (publication)
- Observability Runtime (traces)
- Plugins métier (ToolHandler)

### Implémentations attendues

- `DefaultActionRuntime`
- `SandboxedActionRuntime` (isolation des plugins tiers)
- `RemoteActionRuntime` (appel de plugins distants)

---

## 9. Memory Runtime

### Responsabilité

Memory Runtime centralise toutes les formes de mémoire et les rend disponibles au Context Runtime et au Decision Runtime.

### Contrat public

```ts
interface MemoryRuntime {
  append(entry: MemoryEntry): Promise<void>;
  recall(query: MemoryQuery, context: ExecutionContext): Promise<MemoryResult[]>;
}

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

### Dépendances

- Aucune.

### Implémentations attendues

- `SqliteMemoryRuntime`
- `PostgresMemoryRuntime`
- `VectorMemoryRuntime` (recherche sémantique dans la mémoire)
- `InMemoryMemoryRuntime` (tests)

---

## 10. Knowledge Runtime

### Responsabilité

Knowledge Runtime gère les sources de connaissance d'un workspace et fournit une recherche unifiée (lexicale, vectorielle, hybride).

### Contrat public

```ts
interface KnowledgeRuntime {
  registerSource(source: KnowledgeSource): Promise<void>;
  ingest(sourceId: string, document: DocumentInput): Promise<IngestionResult>;
  search(query: KnowledgeQuery): Promise<KnowledgeResult[]>;
  hybridSearch(query: KnowledgeQuery, embedding: readonly number[]): Promise<KnowledgeResult[]>;
}

interface KnowledgeSource {
  readonly id: string;
  readonly name: string;
  readonly type: "documents" | "database" | "api" | "website" | "github" | "email";
}
```

### Dépendances

- Vector Adapter
- Document Adapter
- OCR Adapter
- LLM Runtime (embeddings)

### Implémentations attendues

- `DefaultKnowledgeRuntime`
- `ZVecKnowledgeRuntime`
- `SqliteFtsKnowledgeRuntime`

---

## 11. Event Runtime

### Responsabilité

Event Runtime est le système nerveux de OIP. Il reçoit, route, persiste et distribue tous les événements du système.

### Contrat public

```ts
interface EventRuntime {
  publish(event: DomainEvent, context: ExecutionContext): Promise<void>;
  subscribe(filter: EventFilter, handler: EventHandler): Promise<Subscription>;
  replay(filter: EventFilter, from: string, to?: string): Promise<DomainEvent[]>;
}

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

### Dépendances

- Aucune.

### Implémentations attendues

- `InMemoryEventRuntime` (tests)
- `SqliteEventRuntime`
- `PostgresEventRuntime`
- `KafkaEventRuntime` (cloud)
- `RedisEventRuntime`

---

## 12. Skill Runtime

### Responsabilité

Skill Runtime exécute des compétences réutilisables indépendantes du LLM : response building, clarification, fallback, UI guidance.

### Contrat public

```ts
interface SkillRuntime {
  invoke(skillId: string, input: SkillInput, context: ExecutionContext): Promise<SkillResult>;
  list(context: ExecutionContext): Promise<SkillDefinition[]>;
}

interface SkillDefinition {
  readonly id: string;
  readonly type: "core" | "product" | "enterprise" | "user" | "ui";
  readonly description: string;
  readonly parameters: SkillParameter[];
}
```

### Dépendances

- Aucune dépendance technique.
- Peut appeler LLM Runtime pour certains skills, mais ce n'est pas obligatoire.

### Implémentations attendues

- `ResponseBuilderSkill`
- `ClarificationSkill`
- `FallbackSkill`
- `PageAgentSkill` (UI skill)
- `SummarizationSkill`

---

## 13. Observability Runtime

### Responsabilité

Observability Runtime trace toute l'activité technique et métier de la plateforme.

### Contrat public

```ts
interface ObservabilityRuntime {
  trace<T>(name: string, metadata: JsonObject, operation: () => Promise<T>): Promise<T>;
  log(event: ObservabilityEvent): Promise<void>;
  span(name: string, metadata: JsonObject): Promise<Span>;
}

interface ObservabilityEvent {
  readonly type: "llm" | "action" | "workflow" | "decision" | "error" | "metric";
  readonly workspaceId: string;
  readonly requestId: string;
  readonly metadata: JsonObject;
  readonly occurredAt: string;
}
```

### Dépendances

- Aucune.

### Implémentations attendues

- `LangfuseObservabilityRuntime`
- `OpenTelemetryObservabilityRuntime`
- `InMemoryObservabilityRuntime` (tests)

---

## 14. Automation Runtime

### Responsabilité

Automation Runtime connecte OIP aux plateformes d'automatisation externe, principalement pour les intégrations B2B.

### Contrat public

```ts
interface AutomationRuntime {
  trigger(workflowId: string, payload: JsonObject): Promise<void>;
  registerWebhook(config: WebhookConfig, handler: WebhookHandler): Promise<void>;
  listWorkflows(): Promise<AutomationWorkflow[]>;
}
```

### Dépendances

- Aucune.

### Implémentations attendues

- `N8nAutomationRuntime`
- `ZapierAutomationRuntime`
- `InMemoryAutomationRuntime` (tests)

---

## 15. MCP Runtime

### Responsabilité

MCP Runtime implémente le Model Context Protocol pour exposer et consommer des outils de manière standardisée.

### Contrat public

```ts
interface McpRuntime {
  serve(serverConfig: McpServerConfig): Promise<void>;
  callTool(serverName: string, toolName: string, args: JsonObject): Promise<JsonObject>;
  listTools(serverName: string): Promise<McpToolDefinition[]>;
}
```

### Dépendances

- Aucune.

### Implémentations attendues

- `McpSdkRuntime`
- `InMemoryMcpRuntime` (tests)

---

## Matrice de dépendances entre Runtimes

```text
                          Channel
                             │
                             ▼
                         Identity
                             │
                             ▼
              ┌──────────────┼──────────────┐
              │              │              │
              ▼              ▼              ▼
          Context        Policy          Event
              │              │              │
              ▼              ▼              ▼
             LLM ◄──────── Decision ───────► Workflow
              │              │              │
              ▼              ▼              ▼
          Knowledge     Action ◄───────────┘
              │              │
              ▼              ▼
           Memory       Observability
              │
              ▼
            Skill
```

**Légende :** les flèches indiquent le flux principal de contrôle. Les dépendances au niveau des contrats peuvent exister dans les deux sens (ex: Action Runtime publie sur Event Runtime).

---

## Notes d'implémentation

- Chaque Runtime doit être développé sous forme de package indépendant : `packages/<runtime>-runtime/src/`.
- Chaque Runtime expose un contrat dans `packages/<runtime>-runtime/src/contract.ts`.
- Les implémentations par défaut (in-memory) vivent dans `packages/<runtime>-runtime/src/adapters/`.
- Les adapters externes vivent dans `packages/adapters/<technology>/`.

---

> Document conceptuel. Aucune modification du code source n'a été effectuée.
