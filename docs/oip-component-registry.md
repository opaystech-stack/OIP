# Registre des composants OIP

Mis a jour : 2026-07-18

| Etat | Composants |
|---|---|
| Actifs canoniques | contracts, identity, context, memory, knowledge, decision, policy, action, event, workflow durable, Provider/Agent Registry, observabilite d'execution, plugin SDK, `OipRuntime`. |
| En migration | `ActionEngine`, `ContextBuilder`, `MemoryStore`, `EventBus`, `WorkflowEngine`, `ChatService`, API demo. |
| Obsoletes | `ComposedRuntime`, `RuleBasedPlanner`, `LlmPlanner` et `OipRuntime.execute` comme entrees de production. Les symbols restent temporairement deprecies pour compatibilite. |
| Stubs bloquants | identity in-memory, embedding vide, persistence workflow/observabilite in-memory par defaut, adapters externes in-memory. `KnowledgeEngineRuntime` alimente maintenant le contexte mais son ingestion generique reste non implementee. |
