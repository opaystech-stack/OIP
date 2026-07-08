# ADR-008 : Discovery — analyse d'applications existantes

## Statut

Proposed

## Date

2026-07-08

## Contexte

Les applications existantes doivent rejoindre le cycle de vie OIP. Pour cela, il faut comprendre leur structure sans les modifier.

## Décision

Le **Discovery** est le pilier chargé d'analyser une codebase existante et de produire un **Manifest proposé**.

### Règles

- Le Discovery ne modifie jamais le code analysé.
- Le Discovery produit un `opays.manifest.proposed.yaml`.
- Le Discovery ne remplace jamais un Manifest validé existant.
- Le Discovery identifie architecture, modules, services, routes, composants IA, dépendances, capabilities, adaptateurs, risques et dette technique.
- Le Discovery accompagne le Manifest d'un rapport d'analyse.

## Responsabilités du Discovery

- Lire la structure du dépôt.
- Identifier les modules métier.
- Identifier les services et endpoints.
- Détecter les points d'entrée IA existants.
- Identifier les composants à remplacer par OIP.
- Proposer des capabilities.
- Identifier les adaptateurs nécessaires.
- Détecter les dépendances critiques.
- Évaluer les risques et la dette technique.
- Produire un diff si un Manifest existe déjà.

## Conséquences

- Les applications existantes peuvent entrer dans le cycle OIP sans rupture.
- La qualité du Manifest dépend de la qualité de l'analyse.
- Un humain doit toujours valider le Manifest proposé.

## Références

- `docs/oip-discovery-role.md`
- `docs/oip-discovery-to-manifest.md`
- `docs/oip-manifest-analysis-guide.md`
