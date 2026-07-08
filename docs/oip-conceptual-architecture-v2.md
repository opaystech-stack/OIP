# Opays Intelligence Platform — Architecture Conceptuelle v2

> Version: 2.0.0  
> Statut: Conceptuel — en attente de validation avant implémentation  
> Auteur: Principal Software Architect — OIP  
> Date: Juillet 2026

---

## 1. Vision conceptuelle

### 1.1 Définition exacte d'OIP

**Opays Intelligence Platform (OIP)** est un système d'exploitation pour les logiciels de l'entreprise Opays.

Contrairement à un moteur conversationnel, OIP ne fournit pas seulement une couche de dialogue. Il fournit une **infrastructure d'exécution, de gouvernance, de mémoire et de connaissance** sur laquelle chaque produit Opays peut s'appuyer pour exposer ses capacités métier via le langage naturel.

**Analogie:**
- Un moteur conversationnel est une application.
- OIP est le système d'exploitation sur lequel cette application — et toutes les autres — s'exécutent.

### 1.2 Promesse fondamentale

> Tout logiciel Opays peut être piloté par langage naturel, sans que son métier ne soit jamais écrit dans le moteur OIP.

Les produits Opays (Commerce, RH, Immobilier, Cadastre, Juridique, Logistique, ONG, Santé, Éducation) ne sont **pas des applications intelligentes**. Ce sont des **plugins** qui déclarent leurs capacités à OIP. L'intelligence réside dans OIP.

### 1.3 Loi d'or de l'architecture

> **Le moteur comprend, planifie, raisonne et choisit. Les applications exécutent.**

Aucune logique métier ne doit vivre dans OIP. OIP fournit les conditions pour que les applications métier exécutent leurs propres règles, dans un contexte sécurisé, traçable et gouverné.

---

## 2. Unité fondamentale : le Workspace

### 2.1 Définition

Un **Workspace** est un environnement métier complet, détenu par une organisation, qui regroupe :

- Un ensemble de **plugins** activés (ex: Commerce + RH + Juridique).
- Des **politiques** de gouvernance (RBAC, ABAC, conformité, règles métier).
- Des **sources de connaissance** (documents, bases SQL, APIs, historiques).
- Des **mémoires** (conversationnelles, utilisateurs, organisationnelles).
- Des **identités** (utilisateurs, rôles, permissions, tokens).
- Des **workflows** configurés.
- Des **configurations** (langue, fournisseur LLM, adapters actifs).

### 2.2 Pourquoi Workspace et non Application

Le terme **Application** renvoie à une interface, à un binaire, à un produit fini. OIP ne délivre pas des applications. OIP délivre des **environnements d'exécution** dans lesquels les produits métier cohabitent.

**Différences clés :**

| Application | Workspace |
|-------------|-----------|
| Produit fini | Environnement d'exécution |
| Généralement isolé | Multi-plugins par design |
| Définit son propre auth | Auth fournie par Identity Runtime |
| Contient son métier | Contient la configuration, pas le métier |
| UI-centric | Capability-centric |

Un produit Opays (ex: Opays Commerce) devient **un plugin activé dans un ou plusieurs workspaces**.

---

## 3. Schéma de l'architecture cible

### 3.1 Vue synthétique

```text
┌─────────────────────────────────────────────────────────────────────┐
│                         Interfaces Utilisateur                       │
│   Web  ·  Mobile Expo  ·  WhatsApp  ·  Telegram  ·  API  ·  Voix     │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        Opays Intelligence Platform                   │
│                                                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐             │
│  │   Channel    │  │   Identity   │  │   Context    │             │
│  │   Runtime    │  │   Runtime    │  │   Runtime    │             │
│  └──────────────┘  └──────────────┘  └──────────────┘             │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │                    Decision Runtime                            │  │
│  │   (intention → discovery → sélection → planification)          │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐             │
│  │   Policy     │  │   Workflow   │  │   Action     │             │
│  │   Runtime    │  │   Runtime    │  │   Runtime    │             │
│  └──────────────┘  └──────────────┘  └──────────────┘             │
│                                                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐             │
│  │   Memory     │  │  Knowledge   │  │   Event      │             │
│  │   Runtime    │  │   Runtime    │  │   Runtime    │             │
│  └──────────────┘  └──────────────┘  └──────────────┘             │
│                                                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐             │
│  │    Skill     │  │     LLM      │  │Observability │             │
│  │   Runtime    │  │   Runtime    │  │   Runtime    │             │
│  └──────────────┘  └──────────────┘  └──────────────┘             │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                           Adapters                                  │
│   Vector  ·  Document  ·  OCR  ·  LLM  ·  Workflow  ·  MCP  ·  ... │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         Plugins Métier                               │
│   Commerce  ·  RH  ·  Immobilier  ·  Cadastre  ·  Juridique  · ...  │
└─────────────────────────────────────────────────────────────────────┘
```

### 3.2 Principe de layering

```text
Layer 1 — Interfaces       (canaux entrants)
Layer 2 — Runtime API      (Channel, Identity, Context)
Layer 3 — Runtime Core     (Decision, Policy, Workflow, Action)
Layer 4 — Runtime State    (Memory, Knowledge, Event)
Layer 5 — Runtime Models   (Skill, LLM, Observability)
Layer 6 — Adapters         (abstractions techniques)
Layer 7 — Plugins          (logique métier)
```

Chaque Runtime du Layer 2, 3, 4, 5 expose un **contrat public** et consomme les contrats des autres Runtimes via des **interfaces**, jamais via des implémentations concrètes.

---

## 4. Runtimes de la plateforme

### 4.1 Channel Runtime

**Responsabilité :** normaliser les entrées/sorties de tous les canaux.

**Rôle :**
- Recevoir un message d'un canal (web, mobile, WhatsApp, Telegram, API, voix).
- Transformer ce message en `InboundRequest` normalisé.
- Router la réponse du moteur vers le canal approprié.
- Gérer les spécificités de chaque canal (longueur, médias, boutons, voice-to-text).

**Contrat public :**
```ts
interface ChannelRuntime {
  receive(channel: Channel, payload: ChannelPayload): Promise<InboundRequest>;
  send(channel: Channel, response: OutboundResponse): Promise<void>;
}
```

**Implémentations futures :** `WebChannelAdapter`, `WhatsAppChannelAdapter`, `TelegramChannelAdapter`, `VoiceChannelAdapter`, `ApiChannelAdapter`.

**Remplaçable sans impacter les autres ?** Oui.

---

### 4.2 Identity Runtime

**Responsabilité :** authentifier, autoriser et scoper tout appel à un workspace.

**Rôle :**
- Valider l'identité de l'utilisateur ou du service.
- Résoudre le workspace actif.
- Fournir un `IdentityContext` contenant userId, organizationId, roles, scopes, permissions.
- Gérer les tokens, les sessions, les API keys.
- Intégrer les providers d'identité (SSO, OAuth, etc.).

**Contrat public :**
```ts
interface IdentityRuntime {
  authenticate(request: InboundRequest): Promise<IdentityContext>;
  resolveWorkspace(identity: IdentityContext): Promise<Workspace>;
  authorize(identity: IdentityContext, resource: string, action: string): Promise<boolean>;
}
```

**Remplaçable sans impacter les autres ?** Oui.

---

### 4.3 Context Runtime

**Responsabilité :** assembler le contexte complet avant que le Decision Runtime ne travaille.

**Rôle :**
- Collecter le contexte de l'utilisateur (rôle, module actif, page, langue, préférences).
- Interroger Memory Runtime pour l'historique conversationnel.
- Interroger Knowledge Runtime pour les connaissances pertinentes.
- Produire un `ExecutionContext` enrichi, immutable et traçable.

**Contrat public :**
```ts
interface ContextRuntime {
  build(input: InboundRequest, identity: IdentityContext): Promise<ExecutionContext>;
}
```

**Remplaçable sans impacter les autres ?** Oui, mais il dépend de Memory et Knowledge Runtime.

---

### 4.4 LLM Runtime

**Responsabilité :** exécuter tous les appels aux modèles de langage et de fondation.

**Rôle :**
- Générer du texte structuré (JSON, plans, intentions).
- Produire des embeddings.
- Normaliser les réponses entre fournisseurs.
- Gérer le routage par modèle, le fallback, le retry, le budgeting.
- Ne jamais prendre de décision métier.

**Contrat public :**
```ts
interface LlmRuntime {
  generateText(request: LlmRequest): Promise<LlmResponse>;
  generateJson<T>(request: LlmRequest, schema: JsonSchema): Promise<T>;
  embed(text: string): Promise<readonly number[]>;
}
```

**Implémentations possibles :** OpenAI-compatible, OpenRouter, Ollama, Anthropic, Gemini, DeepSeek, Kimi, Qwen.

**Remplaçable sans impacter les autres ?** Oui.

---

### 4.5 Decision Runtime

**Responsabilité :** transformer une intention exprimée en plan d'exécution validable.

**Rôle :**
- Recevoir une `Intention` (issue du LLM Runtime, d'un événement, d'une API, d'un workflow).
- Découvrir les capabilities candidates via Capability Registry.
- Filtrer par workspace, plugins actifs, rôles, contexte.
- Sélectionner la meilleure capability ou combinaison de capabilities.
- Construire un `ExecutionPlan`.
- Gérer les ambiguïtés (demander clarification à l'utilisateur).
- Décider d'un workflow vs une action simple.

**Point clé :** le LLM Runtime n'exprime que l'intention. Le Decision Runtime traduit cette intention en plan.

**Contrat public :**
```ts
interface DecisionRuntime {
  decide(intent: Intention, context: ExecutionContext): Promise<DecisionResult>;
}

type DecisionResult =
  | { type: "plan"; plan: ExecutionPlan }
  | { type: "clarify"; question: string; candidates: CapabilityCandidate[] }
  | { type: "reject"; reason: string };
```

**Remplaçable sans impacter les autres ?** Oui. C'est le cœur de l'intelligence, mais il est interchangeable tant qu'il respecte le contrat.

---

### 4.6 Policy Runtime

**Responsabilité :** gouverner ce qui est autorisé, obligatoire ou interdit.

**Rôle :**
- Évaluer les politiques avant, pendant et après l'exécution.
- RBAC, ABAC, consentement, conformité réglementaire.
- Règles métier conditionnelles (seuils, horaires, double validation).
- Gestion des exceptions et overrides.
- Produire un `PolicyDecision` : allow / deny / confirm / escalate.

**Contrat public :**
```ts
interface PolicyRuntime {
  evaluate(request: PolicyRequest, context: ExecutionContext): Promise<PolicyDecision>;
}
```

**Remplaçable sans impacter les autres ?** Oui.

---

### 4.7 Workflow Runtime

**Responsabilité :** orchestrer des processus métier multi-étapes.

**Rôle :**
- Exécuter des workflows déclarés par les plugins.
- Gérer l'état, les transitions, les compensations, les reprises sur erreur.
- Orchestrer les capabilities via Action Runtime.
- Support du human-in-the-loop.

**Point clé :** Workflow Runtime est une abstraction. LangGraph, Temporal, n8n, ou un moteur maison sont des implémentations possibles derrière `WorkflowAdapter`.

**Contrat public :**
```ts
interface WorkflowRuntime {
  start(workflowId: string, args: JsonObject, context: ExecutionContext): Promise<WorkflowExecution>;
  signal(executionId: string, signal: WorkflowSignal): Promise<void>;
  getState(executionId: string): Promise<WorkflowState>;
}
```

**Remplaçable sans impacter les autres ?** Oui.

---

### 4.8 Action Runtime

**Responsabilité :** exécuter une seule capability métier de manière atomique, sécurisée et traçable.

**Rôle :**
- Valider les arguments d'une capability.
- Vérifier les permissions via Policy Runtime.
- Demander confirmation si nécessaire.
- Appeler le ToolHandler du plugin.
- Publier les événements générés sur Event Runtime.
- Journaliser sur Audit Runtime.
- Retourner un `ActionResult`.

**Contrat public :**
```ts
interface ActionRuntime {
  execute(action: PlannedAction, context: ExecutionContext): Promise<ActionResult>;
}
```

**Remplaçable sans impacter les autres ?** Oui, mais c'est le runtime le plus critique.

---

### 4.9 Memory Runtime

**Responsabilité :** centraliser toutes les formes de mémoire.

**Rôle :**
- Mémoire conversationnelle (historique).
- Mémoire utilisateur (préférences, alias, habitudes).
- Mémoire organisationnelle (patterns d'usage, décisions fréquentes).
- Mémoire épisodique (événements importants).
- Fournir les souvenirs pertinents au Context Runtime.

**Contrat public :**
```ts
interface MemoryRuntime {
  append(entry: MemoryEntry): Promise<void>;
  recall(query: MemoryQuery, context: ExecutionContext): Promise<MemoryResult[]>;
}
```

**Remplaçable sans impacter les autres ?** Oui.

---

### 4.10 Knowledge Runtime

**Responsabilité :** centraliser l'accès aux connaissances structurées et non structurées.

**Rôle :**
- Gérer les sources de connaissance d'un workspace.
- Ingestion : PDF, Word, Excel, PowerPoint, images, sites web, Markdown, HTML, emails, GitHub, APIs, bases SQL.
- Indexation : full-text, vectorielle, hybride.
- Recherche contextuelle pour le Context Runtime.
- Ne jamais modifier les données métier sources.

**Contrat public :**
```ts
interface KnowledgeRuntime {
  register(source: KnowledgeSource): Promise<void>;
  search(query: KnowledgeQuery): Promise<KnowledgeResult[]>;
  ingest(sourceId: string, document: DocumentInput): Promise<IngestionResult>;
}
```

**Remplaçable sans impacter les autres ?** Oui.

---

### 4.11 Event Runtime

**Responsabilité :** gérer tous les événements du système.

**Rôle :**
- Bus d'événements.
- Event sourcing léger pour les actions critiques.
- Projections pour analytics, notifications, synchronisations UI.
- Garanties configurables (at-least-once, ordering, persistence).
- Découplage entre Action Runtime et consommateurs.

**Contrat public :**
```ts
interface EventRuntime {
  publish(event: DomainEvent, context: ExecutionContext): Promise<void>;
  subscribe(filter: EventFilter, handler: EventHandler): Promise<Subscription>;
}
```

**Remplaçable sans impacter les autres ?** Oui.

---

### 4.12 Skill Runtime

**Responsabilité :** exécuter des compétences réutilisables indépendamment du LLM.

**Rôle :**
- Core Skills : parsing, fallback, clarification, response building.
- Product Skills : compétences transverses par domaine.
- Enterprise Skills : compétences propres à l'organisation.
- User Skills : compétences créées par l'utilisateur.
- UI Skills : onboarding, aide contextuelle, tutoriels, Page Agent.

**Contrat public :**
```ts
interface SkillRuntime {
  invoke(skillId: string, input: SkillInput, context: ExecutionContext): Promise<SkillResult>;
  list(context: ExecutionContext): Promise<SkillDefinition[]>;
}
```

**Remplaçable sans impacter les autres ?** Oui.

---

### 4.13 Observability Runtime

**Responsabilité :** observer, mesurer et tracer toute l'activité de la plateforme.

**Rôle :**
- Traces techniques (OpenTelemetry).
- Traces LLM (Langfuse).
- Latence par runtime.
- Coût par requête.
- Taux d'erreur par capability.
- Audit log métier.

**Contrat public :**
```ts
interface ObservabilityRuntime {
  trace<T>(name: string, metadata: JsonObject, operation: () => Promise<T>): Promise<T>;
  log(event: ObservabilityEvent): Promise<void>;
}
```

**Remplaçable sans impacter les autres ?** Oui.

---

### 4.14 Automation Runtime

**Responsabilité :** connecter OIP aux outils d'automatisation externe.

**Rôle :**
- Déclencher des workflows n8n.
- Recevoir des webhooks.
- Intégrer CRM, ERP, email, messagerie.

**Contrat public :**
```ts
interface AutomationRuntime {
  trigger(workflowId: string, payload: JsonObject): Promise<void>;
  registerWebhook(config: WebhookConfig, handler: WebhookHandler): Promise<void>;
}
```

**Remplaçable sans impacter les autres ?** Oui.

---

### 4.15 MCP Runtime

**Responsabilité :** héberger et consommer des serveurs Model Context Protocol.

**Rôle :**
- Exposer les outils OIP comme serveurs MCP.
- Consommer des outils externes via MCP.
- Standardiser l'accès aux connecteurs.

**Contrat public :**
```ts
interface McpRuntime {
  callTool(serverName: string, toolName: string, args: JsonObject): Promise<JsonObject>;
  listTools(serverName: string): Promise<McpToolDefinition[]>;
}
```

**Remplaçable sans impacter les autres ?** Oui.

---

## 5. Matrice de remplaçabilité des Runtimes

| Runtime | Dépend directement de | Peut être remplacé sans impact | Note |
|---|---|---|---|
| Channel Runtime | Identity, Context | ✅ Oui | Canal purement entrée/sortie |
| Identity Runtime | — | ✅ Oui | Provider d'identité interchangeable |
| Context Runtime | Memory, Knowledge | ✅ Oui | Stratégie de contexte interchangeable |
| LLM Runtime | — | ✅ Oui | Fournisseur LLM interchangeable |
| Decision Runtime | Context, LLM, Memory, Knowledge, Policy | ✅ Oui | Moteur de décision interchangeable |
| Policy Runtime | Identity | ✅ Oui | Moteur de règles interchangeable |
| Workflow Runtime | Action, Event | ✅ Oui | LangGraph = une implémentation |
| Action Runtime | Policy, Event, Plugins | ⚠️ Forte vigilance | Cœur de l'exécution, mais contrat stable |
| Memory Runtime | — | ✅ Oui | Store de mémoire interchangeable |
| Knowledge Runtime | Vector, Document, OCR adapters | ✅ Oui | Moteur de recherche interchangeable |
| Event Runtime | — | ✅ Oui | Bus interchangeable |
| Skill Runtime | — | ✅ Oui | Catalogue de skills interchangeable |
| Observability Runtime | — | ✅ Oui | Backend de traces interchangeable |
| Automation Runtime | — | ✅ Oui | Outil d'automation interchangeable |
| MCP Runtime | — | ✅ Oui | Protocole MCP, implémentations variées |

**Règle absolue :** aucun Runtime ne connaît l'implémentation d'un autre Runtime. Toute communication passe par un contrat public.

---

## 6. Flux d'exécution entre Runtimes

### 6.1 Flux principal : requête en langage naturel

```text
1. Channel Runtime reçoit l'input
        │
        ▼
2. Identity Runtime authentifie et résout le Workspace
        │
        ▼
3. Context Runtime interroge Memory Runtime et Knowledge Runtime
        │
        ▼
4. LLM Runtime produit une Intention structurée
        │
        ▼
5. Decision Runtime traduit l'Intention en ExecutionPlan
   (capability discovery, scoring, planning)
        │
        ▼
6. Policy Runtime valide le plan
        │
        ▼
7. Si workflow → Workflow Runtime
   Si action simple → Action Runtime
        │
        ▼
8. Action Runtime exécute le Tool du plugin
        │
        ▼
9. Event Runtime publie les événements
        │
        ▼
10. Memory Runtime mémorise l'interaction
        │
        ▼
11. Skill Runtime (Response Builder) génère la réponse
        │
        ▼
12. Channel Runtime retourne la réponse à l'utilisateur
```

### 6.2 Flux secondaire : événement déclenché

```text
1. Plugin métier ou système externe publie un événement
        │
        ▼
2. Event Runtime reçoit l'événement
        │
        ▼
3. Decision Runtime détecte une opportunité d'action
        │
        ▼
4. Policy Runtime valide
        │
        ▼
5. Workflow / Action Runtime exécute
        │
        ▼
6. Memory Runtime met à jour l'état
        │
        ▼
7. Channel Runtime notifie si nécessaire
```

### 6.3 Flux de clarification

```text
1. Decision Runtime ne peut pas choisir une capability unique
        │
        ▼
2. Skill Runtime (Clarification Skill) génère une question
        │
        ▼
3. Channel Runtime envoie la question à l'utilisateur
        │
        ▼
4. Réponse utilisateur reprise par Channel Runtime
        │
        ▼
5. Context Runtime met à jour le contexte
        │
        ▼
6. Decision Runtime relance avec contexte enrichi
```

---

## 7. Contrats publics fondamentaux

### 7.1 InboundRequest

```ts
interface InboundRequest {
  readonly channel: "web" | "mobile" | "whatsapp" | "telegram" | "api" | "voice";
  readonly rawPayload: unknown;
  readonly text?: string;
  readonly attachments?: Attachment[];
  readonly metadata?: JsonObject;
}
```

### 7.2 ExecutionContext

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

### 7.3 Intention

```ts
interface Intention {
  readonly type: string;
  readonly confidence: number;
  readonly entities: Entity[];
  readonly rawText: string;
  readonly goal: string;
}
```

### 7.4 ExecutionPlan

```ts
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

### 7.5 Capability

```ts
interface Capability {
  readonly id: string;
  readonly pluginId: string;
  readonly workspaceId?: string;
  readonly description: string;
  readonly parameters: CapabilityParameter[];
  requiredRoles: string[];
  policies: string[];
  confirmationLevel: "none" | "low" | "medium" | "high" | "critical";
  sideEffects: string[];
  emits: string[];
}
```

---

## 8. ADR structurantes (Architecture Decision Records)

### ADR-001 — OIP est un système d'exploitation pour logiciels d'entreprise

**Décision :** OIP n'est pas un moteur conversationnel. Il est une infrastructure d'exécution, de gouvernance, de mémoire et de connaissance pour les produits Opays.

**Conséquence :** les produits Opays deviennent des plugins. L'intelligence et l'orchestration vivent dans OIP.

---

### ADR-002 — Architecture par Runtimes autonomes

**Décision :** OIP est composé de Runtimes indépendants, chacun avec une responsabilité unique et un contrat public.

**Conséquence :** aucun Runtime ne connaît l'implémentation interne d'un autre. Les Runtimes communiquent par contrats.

---

### ADR-003 — Toute technologie externe est remplaçable par un Adapter

**Décision :** LLM, workflow engine, vector store, document parser, OCR, observabilité, automation et MCP doivent tous être consommés via des adapters.

**Conséquence :** on peut remplacer LangGraph, ZVec, Docling, PaddleOCR, OpenRouter ou Langfuse sans modifier le core.

---

### ADR-004 — Le LLM n'exprime que des intentions

**Décision :** le LLM Runtime transforme le langage naturel en une `Intention` structurée. Il ne choisit jamais directement de capability, d'outil ou d'action.

**Conséquence :** la sélection et la planification relèvent du Decision Runtime, qui est testable, gouvernable et remplaçable indépendamment du LLM.

---

### ADR-005 — Decision Runtime centralise la planification

**Décision :** toute traduction d'intention en plan d'exécution passe par le Decision Runtime.

**Conséquence :** le Decision Runtime devient un actif stratégique. Il peut être amélioré, versionné, évalué, sans toucher aux canaux ou aux plugins.

---

### ADR-006 — Workspace = unité de tenant métier

**Décision :** le Workspace remplace la notion d'Application. C'est l'environnement complet d'une organisation, contenant plugins, policies, connaissances, mémoires et configurations.

**Conséquence :** un produit Opays est un plugin activé dans un workspace. Un workspace peut activer plusieurs produits.

---

### ADR-007 — Event-First : toute action produit un événement

**Décision :** toute exécution métier génère un événement dans Event Runtime. Les synchronisations, notifications, analytics et projections en découlent.

**Conséquence :** pas de couplage direct entre producteurs et consommateurs. Audit et traçabilité native.

---

### ADR-008 — Capability = unité d'action métier déclarée par plugin

**Décision :** chaque action métier est déclarée comme une capability par un plugin. OIP orchestre, le plugin exécute.

**Conséquence :** le core OIP reste libre de toute logique métier. Les capabilities sont découvrables, versionnables et gouvernables.

---

### ADR-009 — Policy Runtime = gouvernance centralisée

**Décision :** RBAC, ABAC, conformité, consentement et règles métier sont centralisés dans Policy Runtime.

**Conséquence :** les plugins déclarent des policies, mais ne les évaluent pas. La gouvernance est cohérente sur tous les canaux.

---

### ADR-010 — Memory Runtime = mémoire unifiée

**Décision :** toutes les formes de mémoire (conversationnelle, utilisateur, organisationnelle, épisodique) sont gérées par Memory Runtime.

**Conséquence :** un modèle unifié de mémorisation, exploitable par Context Runtime et Decision Runtime.

---

### ADR-011 — Workflow Runtime est une abstraction ; LangGraph n'est qu'une implémentation

**Décision :** Workflow Runtime expose un contrat stable. LangGraph, Temporal, n8n ou un moteur maison peuvent être branchés derrière `WorkflowAdapter`.

**Conséquence :** le choix de l'orchestrateur de workflow n'a pas d'impact sur les plugins ni sur le Decision Runtime.

---

### ADR-012 — Skills indépendants du LLM

**Décision :** les Skills (core, product, enterprise, user, UI) sont des composants exécutables indépendants du modèle de langage utilisé.

**Conséquence :** Page Agent est un UI Skill. Le response builder est un Core Skill. Aucun skill n'est prisonnier d'un LLM.

---

## 9. Principes d'évolution sur dix ans

### 9.1 Stabilité des contrats publics

Les interfaces entre Runtimes doivent rester stables sur plusieurs années. Les implémentations changent, les contrats résistent.

### 9.2 Remplaçabilité systématique

Toute brique technique externe doit pouvoir être remplacée en modifiant uniquement son adapter. Cela inclut les fournisseurs IA, les bases de données, les orchestrateurs, les parsers et les outils d'observabilité.

### 9.3 Séparation stricte intelligence / exécution

OIP raisonne, planifie, gouverne. Les plugins exécutent. Jamais le métier ne pénètre dans le moteur.

### 9.4 Multi-tenant par Workspace

Toute donnée, configuration, mémoire et connaissance sont scopées par Workspace. Un utilisateur dans un workspace ne voit pas un autre workspace.

### 9.5 Event-First et traçabilité

Toute action génère un événement. L'audit est un sous-produit du design, pas une couche ajoutée.

### 9.6 Gouvernance programmable

Les règles de sécurité, de conformité et de confirmation doivent être déclaratives et modifiables sans redéploiement du moteur.

### 9.7 Évaluation continue

Chaque runtime critique (LLM, Decision, Workflow, Action) doit être mesurable, tracé et évalué. Les régressions doivent être détectables par des tests automatisés.

### 9.8 Ouverture par protocoles standards

OIP s'intègre via des protocoles ouverts : MCP, HTTP, OpenAI-compatible, OpenTelemetry. Pas de protocole propriétaire.

### 9.9 Local-first possible

OIP doit pouvoir fonctionner en mode local (Ollama, SQLite, stockage fichiers) aussi bien qu'en mode cloud. C'est une exigence pour les marchés africains.

### 9.10 Évolution par adjonction

Une nouvelle fonctionnalité ne doit jamais modifier un contrat existant sans versionnage. OIP grandit par ajout de Runtimes, d'adapters, de plugins et de skills, pas par réécriture.

---

## 10. Prochaines étapes recommandées

1. **Valider cette Architecture Conceptuelle v2** avec l'équipe produit et technique.
2. **Finaliser le glossaire** : Intention, Capability, Workspace, Skill, Runtime, Adapter.
3. **Modéliser le contrat public de chaque Runtime** en TypeScript.
4. **Valider la map de dépendances** entre Runtimes.
5. **Commencer l'implémentation par les contrats**, puis les adapters, puis la refonte du Runtime.

---

> Ce document reste conceptuel. Aucun fichier source du moteur n'a été modifié pour sa production.
