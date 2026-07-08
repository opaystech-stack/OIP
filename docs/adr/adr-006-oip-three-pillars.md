# ADR-006 : OIP comme plateforme à trois piliers — Discovery, Generator, Runtime

## Statut

Proposed

## Date

2026-07-08

## Contexte

OIP a été initialement conçu comme un moteur d'intelligence métier (Runtime). Nous avons ensuite introduit le Manifest d'intégration comme contrat officiel entre OIP et les applications.

Aujourd'hui, nous faisons évoluer la mission d'OIP pour couvrir l'ensemble du cycle de vie des applications Opays : conception, génération, analyse et intégration.

## Décision

OIP devient une plateforme structurée autour de **trois piliers indépendants** :

1. **Discovery** — comprendre une application existante.
2. **Generator** — créer une nouvelle application.
3. **Runtime** — exécuter l'intelligence.

Ces trois piliers communiquent uniquement via le **Manifest** (`opays.manifest.yaml`).

## Principes dérivés

- Le Manifest est le seul contrat public entre les piliers.
- Aucun pilier ne dépend directement d'un autre.
- Le Runtime reste la fondation inchangée.
- Le Generator et le Discovery viennent compléter OIP, pas le remplacer.
- Aucune logique spécifique à une application n'est ajoutée dans OIP.
- Toute spécialisation métier appartient aux plugins.

## Conséquences

### Positives

- Un cycle de vie unique pour les applications neuves et existantes.
- Un standard unique de conception et d'intégration.
- Un découplage fort entre analyse, génération et exécution.
- Une évolutivité indépendante de chaque pilier.

### Négatives / coûts

- Augmentation du périmètre d'OIP.
- Nécessité de maintenir trois piliers avec des équipes ou des responsabilités claires.
- Besoin d'outillage supplémentaire pour le Discovery et le Generator.

## Alternatives considérées

### Alternative 1 : Garder OIP comme moteur uniquement

Rejeté car cela ne résout pas le besoin de standardiser la naissance et l'évolution des applications.

### Alternative 2 : Fusionner Discovery et Generator

Rejeté car la lecture d'une codebase existante et la création d'une codebase sont deux responsabilités différentes. La séparation garantit la clarté et la testabilité.

## Références

- `docs/oip-three-pillars-architecture.md`
- `docs/adr/adr-005-integration-manifest.md`
- `docs/rfc/rfc-001-discovery-generator-runtime-contracts.md`
- `docs/oip-target-package-structure.md`
