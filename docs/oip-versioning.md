# Strategie de versionnement — OIP

OIP adopte [Semantic Versioning 2.0.0](https://semver.org/lang/fr/) (SemVer) avec des canaux de pre-release explicites.

## Format

```text
MAJOR.MINOR.PATCH[-prerelease][+build]
```

- **MAJOR** : changement incompatible de l’API publique ou rearchitecture majeure.
- **MINOR** : nouvelle fonctionnalite retrocompatible ou extension de l’API publique.
- **PATCH** : correction retrocompatible de bug ou amelioration interne non observable.

## Canaux de pre-release

| Canal | But | Stabilite | Duree indicative |
|---|---|---|---|
| **alpha** | Validation technique en interne. API non figee. | Instable | Jours a quelques semaines |
| **beta** | Pretests avec des consommateurs pilotes. API quasi-figee. | Stable avec reserves | Quelques semaines |
| **rc** (*release candidate*) | Validation finale avant stable. API figee. | Production-ready en test | Quelques jours a une semaine |
| **stable** | Version maintenue et recommandee pour la production. | Garantie de compatibilite | Long terme |

## Regles de transition

- **Alpha → Beta** : la suite de tests complete passe, la documentation est a jour, l’API publique est identifiee.
- **Beta → RC** : au moins un consommateur pilote a integre la version sans regression critique.
- **RC → Stable** : aucune regression decouverte pendant la periode RC, le CHANGELOG est valide, la distribution packagee fonctionne.
- **Stable → MAJOR suivante** : seulement si un changement incompatible est strictement necessaire et documente dans un ADR.

## Branches et tags

- La branche `main` porte la version en cours de developpement.
- Chaque version publiee est taguee `vMAJOR.MINOR.PATCH[-prerelease]`.
- Les hotfixes stable sont branches depuis le tag et mergees dans `main`.

## Exemple de chronologie

```text
v0.1.0-alpha   # socle technique PI-1
v0.2.0-alpha   # consolidation runtime
v0.3.0-beta    # premier consommateur pilote
v0.3.0-rc.1
v0.3.0         # premiere stable
v0.4.0         # nouvelle capability publique
v1.0.0         # premier contrat d’API stable a long terme
```

## Notes

- Pendant les phases alpha/beta, l’API publique peut evoluer. Les applications consommatrices doivent pinner leur dependance exacte (`0.x.y-alpha.z`).
- A partir de `v1.0.0`, tout changement incompatible necessite un numero de version MAJOR et une periode de deprecation.
- Chaque version doit avoir une entree dans `CHANGELOG.md` et une release GitHub associee.

## Processus de release

1. Mettre a jour `CHANGELOG.md` avec la nouvelle version.
2. Mettre a jour `package.json` / `package-lock.json`.
3. Ouvrir une PR dediee (`release/vX.Y.Z`).
4. Apres merge, taguer `git tag vX.Y.Z` et pousser.
5. Publier la release GitHub avec les notes du CHANGELOG.
6. Publier le package sur GitHub Packages (voir `docs/oip-distribution.md`).
