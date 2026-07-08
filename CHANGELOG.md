# Changelog

Toutes les evolutions notables du projet OIP sont documentees dans ce fichier.

Le format est base sur [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/) et ce projet adhere a [Semantic Versioning](https://semver.org/lang/fr/).

## [Unreleased]

### Added

- Consumer Test Project (`consumer-test/`) to validate the external developer experience.
- `defineTool` helper in `@opaystech/oip/core` for ergonomic tool authoring.
- `success` and `rejected` helpers in `@opaystech/oip/core` for clear action results.
- `definePlugin` helper in `@opaystech/oip/plugin-sdk`.
- Documentation updates in `docs/oip-sdk-developer.md` reflecting the new helpers.

### Changed

- Public API entry points clarified: `@opaystech/oip`, `@opaystech/oip/core`, `@opaystech/oip/plugin-sdk`.

### Changed

- `package.json` : passage a `@opaystech/oip` en `v0.1.0-alpha`, exports conditionnels, configuration de publication GitHub Packages.
- `tsconfig.json` : retrait des dossiers `apps/` et `plugins/` au profit d’une unique source de verite `packages/` + `examples/` + `tests/`.
- `apps/api/` → `examples/api-demo/`.
- `plugins/commerce/` et `plugins/hr/` → `examples/plugins/commerce/` et `examples/plugins/hr/`.
- Mise a jour des scripts : `demo:api` remplace `dev:api`.

### Removed

- `dist/` du suivi Git.

## [0.1.0-alpha] — 2026-07-08

### Added

- Monorepo TypeScript minimal sans dependance externe.
- Contrats OIP : Capability, Tool, Plugin, RuntimeContext, PlannedAction, ActionResult, DomainEvent, AuditRecord.
- Capability Registry, Tool Registry, Validator RBAC + confirmation policy.
- Action Engine avec validation, audit et publication d’evenements.
- Event Bus, Audit Log, Conversation Memory, persistance JSON fichier.
- Workflow Engine et orchestration par capability.
- LLM Adapter interface + adaptateurs Mock et OpenAI-compatible.
- LLM Planner, Context Builder, Knowledge Engine, Document Service.
- Vector Adapter + implementation memoire avec similarite cosinus.
- Plugin SDK (`definePluginModule`, `installPluginModule`).
- Facade `OipRuntime` et factory `createRuntimeFromEnv`.
- Runtime builder (`OipRuntimeBuilder`) et `ComposedRuntime`.
- Plugins exemples : Commerce et RH.
- API HTTP demo : health, capabilities, chat, actions, documents, admin.
- Suite de tests end-to-end executable.
- CI GitHub Actions : type check + test.

### Notes

Cette version est une **alpha technique**.  
L’API publique n’est pas figee. Les prochaines iterations (beta, RC, stable) stabiliseront les contrats et la distribution packagee.

[Unreleased]: https://github.com/opaystech-stack/OIP/compare/v0.1.0-alpha...HEAD
[0.1.0-alpha]: https://github.com/opaystech-stack/OIP/releases/tag/v0.1.0-alpha
