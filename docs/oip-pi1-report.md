# Rapport PI-1 — Consolidation du noyau d'exécution OIP

> Date : 8 juillet 2026  
> Branche : `main`  
> Tag de départ : `baseline-oip-v2`

## Objectif

Disposer d'un noyau d'exécution stable reposant sur les nouveaux contrats publics et les nouveaux Runtimes, sans casser le moteur actuel.

## Critères de réussite

- [x] Principaux Runtimes existants (Identity, Event, Memory, Context, Decision, Policy, Action, Knowledge, LLM, Observability, Workflow, Skill, Channel).
- [x] `RuntimeBuilder` compose réellement le moteur via `ComposedRuntime`.
- [x] Couplage fortement réduit : `OipRuntime` ne dépend plus directement des implémentations concrètes legacy.
- [x] Contrats publics stabilisés dans `packages/core/src/contracts`.
- [x] Tous les tests verts : legacy, builder, runtimes, composed.
- [x] Plugins Commerce et RH fonctionnent toujours sans modification fonctionnelle.

## Résultat des tests

```bash
npm run test:all
# → npm run check && npm test && npm run test:builder && npm run test:runtimes && npm run test:composed
# Tous passent (19 legacy + 3 builder + 11 runtimes + 2 composed).
```

## Commits du PI-1

| Commit | Message |
|--------|---------|
| `ef2f86c` | refactor(core): align minimalist contracts with existing types.ts for compatibility |
| `5483285` | feat(runtime): add Identity, Event, Memory, Context, Decision, Policy Runtime with in-memory defaults |
| `7bf87ce` | test(runtime): add unit tests for Identity, Event, Memory, Context, Decision, Policy Runtimes |
| `9151949` | feat(runtime): make RuntimeBuilder compose ComposedRuntime while preserving OipRuntime compatibility |
| `0bc9575` | refactor(runtime): use Memory and Event Runtime through bridge adapters in OipRuntime defaults |
| `7d3c8fb` | refactor(runtime): replace ContextBuilder with ContextRuntime bridge adapter in OipRuntime |
| `3576938` | refactor(runtime): encapsulate LlmPlanner inside LlmBasedDecisionRuntime |
| `435d26d` | refactor(runtime): remove direct imports of InMemoryStore, InMemoryEventBus and ContextBuilder |
| `9acbdda` | refactor(runtime): consolidate ComposedRuntime and RuntimeBuilder with real defaults |
| `a5c2caa` | feat(runtime): make ComposedRuntime execute through ActionRuntime adapter with test |
| `8274361` | refactor(decision-runtime): extract RuleBasedPlanner from core into decision-runtime |
| `5e129e0` | feat(core): add defineCapability helper and export new capability contracts |

## Runtimes introduits ou consolidés

| Runtime | Package | État |
|---------|---------|------|
| Channel | `channel-runtime` (défaut) | ✅ |
| Identity | `identity-runtime` | ✅ |
| Context | `context-runtime` + `ContextRuntimeBuilderAdapter` | ✅ |
| LLM | `llm-runtime` (défaut) | ✅ |
| Decision | `decision-runtime` (`RuleBased` + `LlmBased`) | ✅ |
| Policy | `policy-runtime` | ✅ |
| Workflow | `workflow-engine` (défaut) | ✅ |
| Action | `action-runtime` (`ActionEngineRuntime`) | ✅ |
| Memory | `memory-runtime` + `LegacyMemoryRuntimeAdapter` | ✅ |
| Knowledge | `knowledge-runtime` (défaut) | ✅ |
| Event | `event-runtime` + `EventRuntimePublisherAdapter` | ✅ |
| Skill | `skill-runtime` (défaut) | ✅ |
| Observability | `observability-runtime` (défaut) | ✅ |
| Automation | `integration-adapters` | ✅ dette |
| MCP | `integration-adapters` | ✅ dette |

## Dépendances supprimées de `OipRuntime`

- `InMemoryStore` (`packages/memory`)
- `InMemoryEventBus` (`packages/event-bus`)
- `ContextBuilder` (`packages/context-builder`)
- `LlmPlanner` (`packages/planner`)

`OipRuntime` fonctionne désormais exclusivement via des adapters bridge qui délèguent aux nouveaux Runtimes, tout en conservant les types publics legacy.

## Contrats publics stabilisés

Situés dans `packages/core/src/contracts` :

- `common.ts` : `JsonValue`, `JsonObject`, etc.
- `capability.ts` : `Capability`, `defineCapability`.
- `intention.ts`, `plan.ts`, `action.ts`
- `identity.ts`, `context.ts`, `event.ts`, `memory.ts`
- `knowledge.ts`, `policy.ts`, `workflow.ts`, `skill.ts`, `channel.ts`
- `runtime.ts` : interfaces des 15 Runtimes + `RuntimeBuilderOptions`

## Tests ajoutés

- `tests/runtime-builder.test.ts` (3 tests)
- `tests/runtimes/*.test.ts` (6 fichiers, 11 tests)
- `tests/composed-runtime.test.ts` (2 tests end-to-end)
- Script global `npm run test:all`

## Détails techniques

### `ComposedRuntime`

- Reçoit les Runtimes injectés via `RuntimeBuilderOptions`.
- Enregistre les plugins via `use(module)`.
- Expose `decide(intent, context)` et `execute(action, context)`.
- Compose l'action via `ActionEngineRuntime`, qui adapte `ExecutionContext` → `RuntimeContext` pour l'`ActionEngine` legacy.

### `OipRuntimeBuilder`

- `build()` retourne `OipRuntime` (compatibilité stricte).
- `buildComposed()` retourne `ComposedRuntime` avec des defaults réels.
- Tous les Runtimes peuvent être injectés ; sinon des implémentations in-memory par défaut sont utilisées.

### Bridge adapters

- `MemoryRuntimeStoreAdapter` : `MemoryRuntime` → `MemoryStore`
- `EventRuntimePublisherAdapter` : `MemoryRuntime` → `EventPublisher` + `list()`
- `ContextRuntimeBuilderAdapter` : `ContextRuntime` → `ContextBuilder`
- `LegacyMemoryRuntimeAdapter` : `MemoryStore` → `MemoryRuntime`
- `ActionEngineRuntime` : `ExecutionContext` → `RuntimeContext` pour `ActionEngine`

## Dettes techniques et risques

| Dette / Risque | Impact | Mitigation |
|----------------|--------|------------|
| `integration-adapters` regroupe Automation + MCP | Faible pour PI-1 | Refactorer en packages spécialisés dans le PI-2 |
| `RuleBasedDecisionRuntime` fait du matching textuel simple | Correct pour la démo mais limité | Passer à `LlmBasedDecisionRuntime` ou enrichir le scoring |
| `ActionEngineRuntime` cast structurel implicite | Maintenance | Aligner progressivement `RuntimeContext` et `ExecutionContext` |
| Coexistence `types.ts` legacy / `contracts/*.ts` | Friction d'import | Migrer graduellement les consommateurs vers `contracts` |
| `RuleBasedPlanner` réexporté depuis `core` | Compatibilité | Supprimer dès que `examples/commerce-demo.ts` est migré |

## Recommandations PI-2

1. Extraire `automation-runtime` et `mcp-runtime` de `integration-adapters`.
2. Migrer `examples/commerce-demo.ts` vers `ComposedRuntime` et supprimer `RuleBasedPlanner` du core.
3. Stabiliser les interfaces LLM et intégrer un vrai adaptateur OpenAI.
4. Introduire un `ChannelRuntime` concret pour WhatsApp/Telegram.
5. Ajouter des tests de charge et de persistance réelle (base de données/file système).

## Conclusion

Le noyau d'exécution du PI-1 est stable et testé. La compatibilité legacy est préservée, le couplage est fortement réduit, et le `ComposedRuntime` constitue désormais le point de composition réel du moteur. Le projet est prêt pour le PI-2.
