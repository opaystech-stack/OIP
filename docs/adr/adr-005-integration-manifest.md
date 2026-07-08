# ADR-005 : Manifest d'intégration versionné comme contrat officiel entre OIP et une application

## Statut

Accepted

## Date

2026-07-08

## Contexte

OIP est un moteur d'intelligence métier destiné à piloter plusieurs applications Opays par le langage naturel. Chaque application possède sa propre architecture, ses modèles de données, ses endpoints et ses règles métier.

Jusqu'à présent, l'intégration d'une nouvelle application pouvait reposer sur l'analyse directe de sa codebase. Cette approche présente plusieurs risques :

- Couplage implicite entre OIP et la structure interne de l'application.
- Fragilité face aux refactorings applicatifs.
- Difficulté à reproduire ou à auditer une intégration.
- Risque d'introduire des logiques applicatives spécifiques dans le moteur OIP.

Nous avons besoin d'un contrat stable, versionné et propriété par l'application.

## Décision

Chaque application intégrée à OIP doit posséder son propre **Manifest d'intégration versionné** (`opays.manifest.yaml` ou `opays.manifest.json`). Ce Manifest devient l'**unique contrat** entre l'application et OIP.

### Principes dérivés

1. **Le Manifest appartient à l'application**, jamais à OIP.
2. **OIP ne dépend jamais de la structure interne** de l'application.
3. **L'analyse automatique génère ou met à jour le Manifest**, mais ne le remplace jamais automatiquement.
4. **Toute migration OIP utilise exclusivement le Manifest validé**.
5. **Aucune logique spécifique à une application** n'est ajoutée dans le moteur OIP.

## Conséquences

### Positives

- OIP reste générique et réutilisable d'une application à l'autre.
- Le contrat d'intégration est explicite, versionné et auditable.
- Les refactorings applicatifs n'impactent OIP tant que le Manifest est maintenu.
- Les migrations peuvent être planifiées et exécutées de manière reproductible.
- L'analyse devient un outil d'aide à la décision, pas une boîte noire.

### Négatives / coûts

- Chaque application doit maintenir un Manifest supplémentaire.
- Le processus d'intégration commence obligatoirement par une phase d'analyse et de validation humaine.
- OIP doit lire et valider le Manifest au démarrage, ce qui ajoute une étape de boot.

## Format

Le format par défaut est **YAML**. Le format JSON est accepté comme alternative stricte.

## Versionnement

Le `manifestVersion` suit SemVer 2.0.0 :

- **MAJOR** : changement incompatible (retrait de capability, changement de contrat d'adaptateur).
- **MINOR** : ajout non cassant (nouvelle capability, nouveau service).
- **PATCH** : correction sans impact fonctionnel.

## Validation

OIP valide le Manifest selon trois niveaux :

1. **Validation de schéma** : conformité au JSON Schema `docs/opays.manifest.schema.json`.
2. **Validation de compatibilité** : la version OIP courante doit être dans l'intervalle `oipCompatibility`.
3. **Validation sémantique** : existence des modules, services, adapters et capabilities référencés.

## Cycle d'intégration

```text
Analyse de la codebase
        ↓
Génération ou comparaison avec le Manifest existant
        ↓
Proposition de diff (opays.manifest.proposed.yaml)
        ↓
Validation humaine
        ↓
Mise à jour officielle du Manifest
        ↓
Blueprint de migration basé sur le Manifest
        ↓
Shadow Mode
        ↓
Migration progressive
        ↓
Suppression du moteur legacy
```

## Alternatives considérées

### Alternative 1 : Introspection runtime de l'application

OIP analyserait dynamiquement l'application au runtime. Rejeté car cela crée un couplage fort et rend les migrations non reproductibles.

### Alternative 2 : Manifest centralisé dans OIP

Un seul Manifest décrirait toutes les applications. Rejeté car cela violerait le principe de propriété et ferait d'OIP le propriétaire du contrat.

### Alternative 3 : Analyse générant directement du code OIP

L'analyse produirait du code métier OIP spécifique à l'application. Rejeté car cela introduirait de la logique applicative dans le moteur.

## Références

- `docs/oip-integration-manifest-spec.md`
- `docs/opays.manifest.schema.json`
- `docs/oip-manifest-analysis-guide.md`
- `docs/oip-manifest-validation-strategy.md`
- `examples/opays.manifest.example.yaml`

## Notes

Cette décision a été validée officiellement comme principe fondamental de la plateforme Opays Intelligence Platform.
