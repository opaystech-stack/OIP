# ADR-007 : Generator — création d'applications à partir du Manifest

## Statut

Proposed

## Date

2026-07-08

## Contexte

Avec l'évolution d'OIP en plateforme à trois piliers, nous devons formaliser la manière dont une nouvelle application est créée.

## Décision

Le **Generator** est le pilier chargé de créer une nouvelle application à partir d'un **Manifest validé**.

### Règles

- Le Generator ne part jamais du code.
- Le Generator ne connaît aucun domaine métier particulier.
- Le Generator produit une codebase directement compatible avec OIP Runtime.
- Le code généré respecte les standards partagés d'OIP.
- Toute personnalisation métier est portée par les plugins, pas par le Generator.

## Responsabilités du Generator

- Générer la structure de projet.
- Générer le backend et le frontend.
- Générer les packages et plugins OIP.
- Générer les capabilities et les tool handlers.
- Générer les adaptateurs OIP nécessaires.
- Générer les workflows.
- Générer les tests.
- Générer le README, la configuration, la CI/CD, la documentation.
- Générer les fichiers Docker si nécessaire.

## Conséquences

- Uniformisation des applications Opays.
- Réduction du temps de démarrage d'un nouveau projet.
- Nécessité d'un moteur de templates maintenu.

## Références

- `docs/oip-generator-role.md`
- `docs/oip-generator-from-manifest.md`
- `docs/oip-integration-manifest-spec.md`
