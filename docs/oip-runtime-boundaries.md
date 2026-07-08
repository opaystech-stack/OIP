# Opays Intelligence Platform — Frontières des Runtimes

> Version: 1.0.0  
> Statut: Validé — socle architectural  
> Date: Juillet 2026

Ce document définit les frontières exactes de chaque Runtime validé. L'objectif est d'éliminer les responsabilités ambiguës, les dépendances circulaires et les tentations de court-circuit.

**Règle absolue :** un Runtime ne fait jamais le travail d'un autre Runtime. Il expose un contrat public et consomme les contrats des autres.

---

## 1. Channel Runtime

### Ce qu'il possède

- La connaissance des protocoles de chaque canal (HTTP, WhatsApp, Telegram, WebSocket, voice).
- La transformation des payloads natifs en `InboundRequest`.
- La transformation des `OutboundResponse` en payload natif.
- La gestion des spécificités de canal (longueur, médias, boutons, transcription).

### Ce qu'il n'a pas le droit de posséder

- Aucune logique métier.
- Aucune connaissance des capabilities, plugins ou workspaces.
- Aucune logique d'authentification (hors parsing de token brut).
- Aucune décision d'exécution.

### Ce qu'il expose

- `receive(channel, payload): InboundRequest`
- `send(channel, response): void`
- `supports(channel): boolean`

### Ce qu'il est autorisé à appeler

- Identity Runtime (transmet l'`InboundRequest` pour authentification).
- Skill Runtime (transmet une `OutboundResponse` à formater avant envoi).

### Ce qui lui est interdit

- Appeler directement Decision Runtime, Action Runtime ou un plugin.
- Exécuter une capability.
- Stocker de la mémoire ou des connaissances.

---

## 2. Identity Runtime

### Ce qu'il possède

- La validation des identités (tokens, sessions, API keys, SSO).
- La résolution du workspace actif à partir de l'identité.
- L'évaluation des permissions de base (scopes, roles).
- La gestion des providers d'identité.

### Ce qu'il n'a pas le droit de posséder

- La logique métier.
- La connaissance des capabilities.
- La décision d'autorisation fine sur une action spécifique (cela relève de Policy Runtime).
- La mémoire ou les connaissances utilisateur.

### Ce qu'il expose

- `authenticate(request): IdentityContext`
- `resolveWorkspace(identity): Workspace`
- `authorize(identity, resource, action): boolean`
- `listPermissions(identity): string[]`

### Ce qu'il est autorisé à appeler

- Aucun autre Runtime en phase normale.
- Peut consulter un store d'identités (via adapter).

### Ce qui lui est interdit

- Décider si une action métier est autorisée (Policy Runtime).
- Connaître la sémantique des capabilities.
- Modifier des données métier.

---

## 3. Context Runtime

### Ce qu'il possède

- L'assemblage du `ExecutionContext`.
- La stratégie de récupération de la mémoire conversationnelle.
- La stratégie de récupération des connaissances pertinentes.
- L'enrichissement par les métadonnées de session (langue, module actif, page).

### Ce qu'il n'a pas le droit de posséder

- La logique métier.
- La planification d'actions.
- La gouvernance.
- L'exécution.

### Ce qu'il expose

- `build(request, identity): ExecutionContext`

### Ce qu'il est autorisé à appeler

- Memory Runtime (`recall`).
- Knowledge Runtime (`search`).
- Identity Runtime (pour lire l'identité déjà résolue).

### Ce qui lui est interdit

- Appeler LLM Runtime.
- Appeler Decision Runtime.
- Appeler Action Runtime ou un plugin.
- Prendre une décision sur l'action à exécuter.

---

## 4. LLM Runtime

### Ce qu'il possède

- L'interface vers tous les modèles de langage.
- La génération de texte structuré.
- La production d'embeddings.
- Le routage, fallback, retry et budgeting par modèle.
- La normalisation des réponses entre fournisseurs.

### Ce qu'il n'a pas le droit de posséder

- La logique métier.
- La connaissance des capabilities.
- La décision d'exécution.
- L'accès à des outils ou services métier.

### Ce qu'il expose

- `generateText(request): LlmResponse`
- `generateJson<T>(request, schema): T`
- `embed(text): number[]`
- `listModels(): LlmModel[]`

### Ce qu'il est autorisé à appeler

- Aucun autre Runtime en phase normale.
- Peut être instrumenté par Observability Runtime (aspect transverse).

### Ce qui lui est interdit

- Choisir une capability.
- Appeler un plugin.
- Produire autre chose qu'une Intention ou une réponse textuelle/structurée.
- Accéder à des données métier.

---

## 5. Decision Runtime

### Ce qu'il possède

- La traduction d'une `Intention` en `ExecutionPlan`.
- La découverte des capabilities candidates.
- Le scoring et la sélection des capabilities.
- La gestion des ambiguïtés (clarification).
- La décision d'action simple vs workflow.

### Ce qu'il n'a pas le droit de posséder

- La logique métier des plugins.
- L'exécution des actions.
- La gouvernance (hors connaissance des rôles nécessaires au filtrage).
- L'accès direct aux bases métier.

### Ce qu'il expose

- `decide(intent, context): DecisionResult`
- `explain(plan): string`
- `discoverCapabilities(context): Capability[]`

### Ce qu'il est autorisé à appeler

- LLM Runtime (pour obtenir une Intention ou ranker des candidates).
- Memory Runtime (patterns historiques).
- Knowledge Runtime (connaissances de planification).
- Identity Runtime / Context Runtime (via le contexte reçu).

### Ce qui lui est interdit

- Exécuter une capability.
- Appeler directement un plugin.
- Modifier des données.
- Décider seul de l'autorisation d'exécution (il peut prédire, mais Policy Runtime valide).

---

## 6. Policy Runtime

### Ce qu'il possède

- L'évaluation des règles de gouvernance.
- RBAC, ABAC, conformité, consentement.
- Les règles métier conditionnelles (seuils, horaires, double validation).
- La gestion des overrides et exceptions.

### Ce qu'il n'a pas le droit de posséder

- La logique métier d'exécution.
- La connaissance de la sémantique exacte des plugins.
- La planification.
- L'accès aux données métier sensibles (seulement les métadonnées nécessaires à l'évaluation).

### Ce qu'il expose

- `evaluate(request, context): PolicyDecision`
- `registerPolicy(policy): void`
- `listPolicies(context): PolicyDefinition[]`

### Ce qu'il est autorisé à appeler

- Identity Runtime (pour lire l'identité via le contexte reçu).
- Event Runtime (pour auditer les décisions de gouvernance si nécessaire).

### Ce qui lui est interdit

- Exécuter des actions métier.
- Modifier des données.
- Remplacer Decision Runtime.
- Court-circuiter Action Runtime.

---

## 7. Workflow Runtime

### Ce qu'il possède

- L'orchestration des processus multi-étapes.
- La gestion de l'état d'un workflow.
- Les transitions, compensations, reprises sur erreur.
- Le support du human-in-the-loop.

### Ce qu'il n'a pas le droit de posséder

- La logique métier des étapes.
- L'exécution directe d'une capability (doit passer par Action Runtime).
- La gouvernance des étapes (sauf orchestration).

### Ce qu'il expose

- `start(workflowId, args, context): WorkflowExecution`
- `signal(executionId, signal): void`
- `getState(executionId): WorkflowState`
- `listDefinitions(context): WorkflowDefinition[]`

### Ce qu'il est autorisé à appeler

- Action Runtime (pour chaque étape métier).
- Policy Runtime (validation globale du workflow).
- Event Runtime (publication d'état).
- Decision Runtime (si relance nécessaire).

### Ce qui lui est interdit

- Appeler directement un plugin.
- Court-circuiter Action Runtime.
- Modifier des données métier directement.

---

## 8. Action Runtime

### Ce qu'il possède

- L'exécution atomique d'une capability.
- La validation des arguments.
- L'appel au `ToolHandler` du plugin.
- La publication d'événements métier.
- L'audit de l'exécution.

### Ce qu'il n'a pas le droit de posséder

- La logique métier des plugins.
- La planification d'actions.
- La décision d'autorisation (hors application de `PolicyDecision` reçu).
- La mémoire ou les connaissances.

### Ce qu'il expose

- `execute(action, context): ActionResult`
- `dryRun(action, context): DryRunResult`

### Ce qu'il est autorisé à appeler

- Policy Runtime (validation avant exécution).
- Event Runtime (publication).
- Observability Runtime (audit/trace).
- ToolHandler du plugin (via Capability Registry).

### Ce qui lui est interdit

- Appeler directement un autre plugin sans passer par les contrats.
- Planifier des étapes.
- Connaître la sémantique métier.
- Modifier des données en dehors du ToolHandler.

---

## 9. Memory Runtime

### Ce qu'il possède

- Le stockage et la récupération des mémoires.
- La typologie des mémoires (conversation, user, organization, episodic).
- La recherche dans la mémoire (textuelle et sémantique).

### Ce qu'il n'a pas le droit de posséder

- La logique métier.
- La planification.
- L'exécution.
- La modification de connaissances structurées.

### Ce qu'il expose

- `append(entry): void`
- `recall(query, context): MemoryResult[]`
- `forget(query): void`

### Ce qu'il est autorisé à appeler

- Aucun autre Runtime en phase normale.
- Peut consulter un Vector Adapter ou un store SQL.

### Ce qui lui est interdit

- Exécuter des actions.
- Appeler un plugin.
- Modifier des données métier.

---

## 10. Knowledge Runtime

### Ce qu'il possède

- L'indexation et la recherche dans les sources de connaissance.
- L'ingestion de documents et de données.
- La recherche lexicale, vectorielle et hybride.
- Le catalogue des sources par workspace.

### Ce qu'il n'a pas le droit de posséder

- La logique métier.
- L'écriture dans les sources métier (ERP, base SQL métier).
- La planification ou l'exécution.
- La gouvernance.

### Ce qu'il expose

- `registerSource(source): void`
- `ingest(sourceId, document): IngestionResult`
- `search(query): KnowledgeResult[]`
- `hybridSearch(query, embedding): KnowledgeResult[]`

### Ce qu'il est autorisé à appeler

- LLM Runtime (embeddings).
- Vector Adapter, Document Adapter, OCR Adapter, SQL Adapter.
- Event Runtime (notifier une ingestion).

### Ce qui lui est interdit

- Modifier les données des sources métier.
- Exécuter des capabilities.
- Appeler un plugin directement.

---

## 11. Event Runtime

### Ce qu'il possède

- La réception, le routage et la persistance des événements.
- Les abonnements et les projections.
- Les garanties de livraison configurables.

### Ce qu'il n'a pas le droit de posséder

- La logique métier des producteurs ou consommateurs.
- La décision d'exécution.
- La modification des données.

### Ce qu'il expose

- `publish(event, context): void`
- `subscribe(filter, handler): Subscription`
- `replay(filter, from, to): DomainEvent[]`

### Ce qu'il est autorisé à appeler

- Aucun autre Runtime en phase normale.
- Les consommateurs s'abonnent.

### Ce qui lui est interdit

- Exécuter des actions métier.
- Court-circuiter Action Runtime.
- Modifier des données directement.

---

## 12. Skill Runtime

### Ce qu'il possède

- Le catalogue et l'exécution des skills.
- Les skills core, product, enterprise, user, UI.
- L'indépendance par rapport au LLM.

### Ce qu'il n'a pas le droit de posséder

- La logique métier des plugins.
- L'exécution des capabilities (sauf invocation via Action Runtime si le skill en a besoin).
- La gouvernance.

### Ce qu'il expose

- `invoke(skillId, input, context): SkillResult`
- `list(context): SkillDefinition[]`

### Ce qu'il est autorisé à appeler

- LLM Runtime (certains skills peuvent l'utiliser).
- Action Runtime (si le skill déclenche une action).
- Memory Runtime (si le skill a besoin de contexte).

### Ce qui lui est interdit

- Appeler directement un plugin.
- Exécuter une capability sans Action Runtime.
- Page Agent ne doit jamais exécuter de logique métier.

---

## 13. Observability Runtime

### Ce qu'il possède

- Les traces techniques et LLM.
- Les métriques, logs, audit.
- La corrélation par requestId.

### Ce qu'il n'a pas le droit de posséder

- La logique métier.
- La décision d'exécution.
- La modification de données.

### Ce qu'il expose

- `trace<T>(name, metadata, operation): T`
- `log(event): void`
- `span(name, metadata): Span`

### Ce qu'il est autorisé à appeler

- Aucun autre Runtime en phase normale.
- Peut écrire vers Langfuse, OpenTelemetry, ou un store local.

### Ce qui lui est interdit

- Exécuter des actions métier.
- Court-circuiter d'autres Runtimes.
- Modifier des données.

---

## 14. Automation Runtime

### Ce qu'il possède

- Le déclenchement de workflows externes.
- La réception de webhooks.
- L'intégration avec n8n, Zapier, etc.

### Ce qu'il n'a pas le droit de posséder

- La logique métier interne.
- La décision d'exécution.
- L'accès direct aux données métier.

### Ce qu'il expose

- `trigger(workflowId, payload): void`
- `registerWebhook(config, handler): void`
- `listWorkflows(): AutomationWorkflow[]`

### Ce qu'il est autorisé à appeler

- Des systèmes externes via HTTP/webhook.
- Event Runtime (publier un événement de déclenchement).

### Ce qui lui est interdit

- Exécuter des capabilities directement.
- Court-circuiter Action Runtime.

---

## 15. MCP Runtime

### Ce qu'il possède

- L'interface Model Context Protocol.
- L'exposition des outils OIP comme serveurs MCP.
- La consommation d'outils externes via MCP.

### Ce qu'il n'a pas le droit de posséder

- La logique métier.
- La décision d'exécution.
- L'accès direct aux données métier.

### Ce qu'il expose

- `callTool(serverName, toolName, args): JsonObject`
- `listTools(serverName): McpToolDefinition[]`
- `serve(serverConfig): void`

### Ce qu'il est autorisé à appeler

- Des serveurs MCP externes.
- Action Runtime (si un tool MCP déclenche une capability).

### Ce qui lui est interdit

- Remplacer Action Runtime.
- Exécuter directement des actions métier.

---

## Matrice des appels autorisés

| Appelant → Appelé | Channel | Identity | Context | LLM | Decision | Policy | Workflow | Action | Memory | Knowledge | Event | Skill | Observability | Automation | MCP |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Channel | — | ✅ | — | — | — | — | — | — | — | — | — | ✅ | — | — | — |
| Identity | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — |
| Context | — | ✅ (lecture) | — | — | — | — | — | — | ✅ | ✅ | — | — | — | — | — |
| LLM | — | — | — | — | — | — | — | — | — | — | — | — | ✅ (instrumentation) | — | — |
| Decision | — | — | — | ✅ | — | — | — | — | ✅ | ✅ | — | — | ✅ | — | — |
| Policy | — | ✅ (lecture) | — | — | — | — | — | — | — | — | ✅ | — | — | — | — |
| Workflow | — | — | — | — | ✅ | ✅ | — | ✅ | — | — | ✅ | — | ✅ | — | — |
| Action | — | — | — | — | — | ✅ | — | — | — | — | ✅ | — | ✅ | — | — |
| Memory | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — |
| Knowledge | — | — | — | ✅ | — | — | — | — | — | — | ✅ | — | — | — | — |
| Event | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — |
| Skill | — | — | — | ✅ | — | — | — | ✅ | ✅ | — | — | — | ✅ | — | — |
| Observability | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — |
| Automation | — | — | — | — | — | — | — | — | — | — | ✅ | — | — | — | — |
| MCP | — | — | — | — | — | — | — | ✅ | — | — | — | — | — | — | — |

Légende :
- ✅ : appel autorisé.
— : appel interdit ou non pertinent.

---

## Anti-patterns détectables

1. **Channel Runtime appelle Action Runtime.** → Interdit.
2. **LLM Runtime retourne un capabilityId.** → Interdit. Doit retourner une Intention.
3. **Decision Runtime exécute une capability.** → Interdit. Doit produire un plan.
4. **Workflow Runtime appelle un ToolHandler directement.** → Interdit. Doit passer par Action Runtime.
5. **Action Runtime appelle un autre Action Runtime.** → Interdit. Doit publier un événement ou retourner un résultat.
6. **Knowledge Runtime modifie une source métier.** → Interdit. Lecture seule.
7. **Skill Runtime exécute du métier directement.** → Interdit. Doit passer par Action Runtime.

---

> Document consolidé. Aucun Runtime supplémentaire n'a été introduit.
