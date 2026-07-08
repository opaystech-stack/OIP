# OIP - Structure Cible du Repository

## Monorepo Cible

```text
opays-intelligence-platform/
  packages/
    core/
    planner/
    validator/
    workflow-engine/
    action-engine/
    knowledge-engine/
    llm-adapter/
    context-builder/
    capability-registry/
    tool-registry/
    event-bus/
    plugin-sdk/
    ui-skills/
    document-service/
    memory/
    shared/
  apps/
    playground/
    studio/
    documentation/
    admin/
  plugins/
    commerce/
    hr/
    real-estate/
    logistics/
    legal/
    ngo/
    cadastre/
```

## Packages Proprietaires Opays

Ces composants portent la valeur strategique principale:

- Opays Planner
- Opays Context Builder
- Opays Action Engine
- Opays Validator
- Opays Workflow Orchestrator
- Opays Capability Registry
- Opays Tool Registry
- Opays Knowledge Engine
- Opays Skill Engine
- Opays Memory Engine
- Opays Plugin SDK
- Opays AI Studio
- Opays Event Bus

## Regle d'Architecture

Le coeur OIP ne doit jamais importer directement une implementation externe.

Exemple attendu:

```text
core -> VectorAdapter interface
zvec-adapter -> implementation concrete
```

Exemple a eviter:

```text
core -> zvec
```

## Premier Plugin Recommande

Le premier plugin doit etre Commerce.

Raison:

- produit deja concret
- workflows riches
- stock, vente, facture, paiement et reporting couvrent plusieurs cas critiques
- bon terrain pour tester permissions, validations et confirmations

