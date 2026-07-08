# Baseline OIP v2

> Date: 8 juillet 2026  
> Tag: `baseline-oip-v2`  
> Branche: `main`

## État du repo

- `npm run check` : OK
- `npm test` : 19 tests passent
- Pas de dépendance runtime
- TypeScript NodeNext / ES2022

## Modifications intégrées à cette baseline

### MCP / Automation

- `packages/integration-adapters/src/index.ts` : implémentations in-memory de `AutomationAdapter` et `McpAdapter`.
- `packages/runtime/src/index.ts` : `OipRuntime` expose `automation` et `mcp` avec implémentations par défaut.
- `tests/oip-core.test.ts` : test de compatibilité des interfaces automation/MCP.

## Dette technique temporaire documentée

- Le package `integration-adapters` regroupe des responsabilités distinctes (Automation, MCP). Il devra être restructuré en packages spécialisés (`automation-runtime`, `mcp-runtime`) lors des Sprints 3+.
- `OipRuntime` importe encore directement des implémentations concrètes. Cela sera corrigé par le `RuntimeBuilder` au Sprint 1.

## Point de départ du Sprint 1

Cette baseline est le point zéro de la migration. Tout commit ultérieur doit améliorer l'architecture sans casser les 19 tests.
