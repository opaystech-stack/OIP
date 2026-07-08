# Opays Intelligence Platform (OIP)

OIP est le moteur d’intelligence conversationnelle produit d’Opays.  
Il transforme le langage naturel en actions métier validées, traçables et orchestrees, sans jamais donner au LLM un droit d’execution direct.

> **Statut** : `v0.1.0-alpha` — socle technique stabilise apres le PI-1.  
> OIP est desormais developpe comme un produit logiciel autonome, consomme par les applications Opays via un package versionne.

## Vision produit

OIP n’est pas un chatbot.  
C’est un **runtime d’intention-action** : les applications declarent leurs capacites, leurs workflows, leurs permissions et leurs sources de connaissance.  
OIP comprend la demande, construit le contexte, planifie, valide, orchestre, puis execute via les services metiers autorises.

Les applications Opays (Commerce, RH, Sante, Immobilier, Forex, Gestion IA, ONG, etc.) deviennent des **consommateurs** d’OIP, pas des proprietaires de sa logique.

## Principe critique

> **Le LLM ne possede aucun droit d’execution directe.**

Il ne fait jamais de SQL, HTTP direct, DOM direct ou appel service metier direct.  
Il choisit uniquement une `capability` declaree. L’Action Engine execute apres validation.

## Démarrage

```bash
npm ci
npm run check
npm run test:all
npm run demo
```

Voir `docs/oip-sdk-developer.md` pour un exemple d’integration minimal.

## Structure du dépôt

```text
.
├── packages/           # Code source publiable d’OIP
│   ├── core/           # Contrats, ActionEngine, Validator, registries, planner
│   ├── runtime/        # Facade OipRuntime et builders
│   ├── plugin-sdk/     # SDK pour ecrire des plugins OIP
│   ├── config/         # Configuration LLM et runtime depuis l’environnement
│   ├── llm-adapter/    # Adaptateurs LLM (mock, OpenAI-compatible)
│   ├── adapters/       # Contrats et implementations memoire des adaptateurs externes
│   ├── chat-service/   # Service de chat haut niveau
│   ├── workflow-engine/# Orchestration de workflows
│   ├── knowledge-engine/# Moteur de connaissance et ingestion documentaire
│   ├── memory/         # Stockage conversationnel
│   └── ...             # Autres runtimes et services
├── examples/           # Démonstrations et consommateurs de reference
│   ├── commerce-demo.ts
│   ├── api-demo/
│   └── plugins/
│       ├── commerce/
│       └── hr/
├── tests/              # Suite de validation executable
├── docs/               # Architecture, ADR, roadmap, SDK
└── .github/            # CI, templates, workflows
```

Seuls les exports documentes constituent l’API publique.

## API publique

L’API stable est exportee par :

- `@opaystech/oip` → `packages/runtime/src/index.ts` (`OipRuntime`, `OipRuntimeOptions`, `createRuntimeFromEnv`)
- `@opaystech/oip/core` → `packages/core/src/index.ts` (contrats, moteurs, helpers)
- `@opaystech/oip/plugin-sdk` → `packages/plugin-sdk/src/index.ts` (`definePluginModule`, `installPluginModule`)

Tout autre import est considere comme interne et peut changer sans notice.

## Documentation

- [Vision et architecture](docs/oip-vision-architecture.md)
- [Contrat de Capability](docs/oip-capability-contract.md)
- [SDK developpeur](docs/oip-sdk-developer.md)
- [Strategie de versionnement](docs/oip-versioning.md)
- [Strategie de distribution](docs/oip-distribution.md)
- [Plan d’integration des applications](docs/oip-integration-plan.md)
- [Etat d’implementation](docs/oip-implementation-status.md)
- [Changelog](CHANGELOG.md)
- [Contributing](CONTRIBUTING.md)

## Gouvernance

- Toute nouvelle abstraction, Runtime ou concept majeur necessite un ADR et un besoin concret.
- Chaque commit publique doit compiler et passer `npm run test:all`.
- Les tests sont traites comme de la documentation executable.

## Licence

Emplacement reserve. Voir [LICENSE](LICENSE).

Copyright (c) Opays.
