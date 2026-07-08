# Structure cible des packages OIP

Cette structure cible introduit les packages `discovery` et `generator` sans casser le `runtime` existant.

---

## Principe

- Le **Runtime** reste dans `packages/runtime` et `packages/core`.
- Le **Discovery** est introduit dans `packages/discovery`.
- Le **Generator** est introduit dans `packages/generator`.
- Le **Manifest** reste un contrat partagé, défini dans `packages/manifest`.
- Les **Plugins** restent dans `packages/plugin-sdk` et dans les applications.

---

## Arborescence cible

```text
OIP/
├── packages/
│   ├── manifest/                 ← Contrat partagé
│   │   ├── src/
│   │   │   ├── schema.ts       ← Types TypeScript du Manifest
│   │   │   ├── validator.ts    ← Validation de schéma + compatibilité
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   ├── core/                   ← Fondations du Runtime (inchangé)
│   ├── runtime/                ← Runtime OIP (inchangé)
│   ├── plugin-sdk/             ← SDK de plugins (inchangé)
│   ├── discovery/              ← Nouveau : pilier Discovery
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── contracts.ts    ← Interfaces publiques Discovery
│   │   │   ├── analyser.ts     ← Orchestrateur d'analyse
│   │   │   ├── readers/        ← Lecteurs par technologie
│   │   │   │   ├── nodejs.ts
│   │   │   │   ├── python.ts
│   │   │   │   └── generic.ts
│   │   │   ├── manifest-builder.ts
│   │   │   └── report.ts
│   │   └── package.json
│   │
│   ├── generator/              ← Nouveau : pilier Generator
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── contracts.ts    ← Interfaces publiques Generator
│   │   │   ├── engine.ts       ← Moteur de génération
│   │   │   ├── templates/        ← Templates de projets
│   │   │   │   ├── backend/
│   │   │   │   ├── frontend/
│   │   │   │   ├── plugin/
│   │   │   │   └── ci-cd/
│   │   │   └── renderers/
│   │   │       ├── typescript.ts
│   │   │       ├── yaml.ts
│   │   │       └── docker.ts
│   │   └── package.json
│   │
│   └── llm-adapter/            ← (inchangé)
│
├── docs/
│   ├── oip-three-pillars-architecture.md
│   ├── oip-integration-manifest-spec.md
│   ├── opays.manifest.schema.json
│   ├── oip-discovery-role.md
│   ├── oip-generator-role.md
│   ├── oip-discovery-to-manifest.md
│   ├── oip-generator-from-manifest.md
│   ├── oip-manifest-analysis-guide.md
│   ├── oip-manifest-validation-strategy.md
│   ├── oip-roadmap-discovery-generator.md
│   ├── adr/
│   │   ├── adr-005-integration-manifest.md
│   │   ├── adr-006-oip-three-pillars.md
│   │   ├── adr-007-generator.md
│   │   └── adr-008-discovery.md
│   └── rfc/
│       └── rfc-001-discovery-generator-runtime-contracts.md
│
├── examples/
│   ├── api-demo/
│   ├── plugins/
│   ├── commerce-demo.ts
│   └── opays.manifest.example.yaml
│
├── consumer-test/
├── validation-suite/
├── tests/
├── package.json
├── tsconfig.json
└── README.md
```

---

## Exports publics cibles

```text
@opaystech/oip/manifest      → types + validation du Manifest
@opaystech/oip/discovery     → API publique du Discovery
@opaystech/oip/generator     → API publique du Generator
@opaystech/oip               → Runtime + re-exports pratiques (inchangé)
```

---

## Découplage

| Package | Dépend de | Ne dépend pas de |
|---|---|---|
| `manifest` | core types | runtime, discovery, generator |
| `core` | - | discovery, generator |
| `runtime` | core, manifest | discovery, generator |
| `discovery` | manifest | runtime, generator |
| `generator` | manifest | runtime, discovery |

---

## Avantages

- Runtime préservé.
- Ajout progressif des nouveaux piliers.
- Pas de rupture pour les consommateurs actuels.
- Modularité et testabilité.

## Références

- `docs/rfc/rfc-001-discovery-generator-runtime-contracts.md`
- `docs/adr/adr-006-oip-three-pillars.md`
- `docs/adr/adr-007-generator.md`
- `docs/adr/adr-008-discovery.md`
