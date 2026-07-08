# Strategie de distribution — OIP

## Objectif

Permettre aux applications Opays de consommer OIP sans copier son code, en respectant trois contraintes :

1. **Autonomie** : OIP est developpe, versionne et publie independamment des applications metier.
2. **Stabilite** : chaque application controle la version d’OIP qu’elle utilise.
3. **Simplicite** : la distribution ne doit pas complexifier le build ou le deploiement des applications existantes.

## Option recommandee : package npm prive sur GitHub Packages

### Pourquoi GitHub Packages

| Critere | Evaluation |
|---|---|
| Association au depot source | Native : `@opaystech/oip` publie depuis `opaystech-stack/OIP` |
| Authentification | Geree par les permissions du depot GitHub |
| Versionnement SemVer | Natif |
| Gestion des prereleases | Natif (alpha, beta, rc) |
| Integration npm / pnpm / yarn | Standard |
| CI/CD | GitHub Actions peut publier automatiquement sur tag |
| Cout | Inclus dans GitHub pour les depots prives |

### Pourquoi pas les autres approches

| Approche | Verdict | Raison |
|---|---|---|
| Copie de code | **Exclue** | Contredit l’objectif : duplication, divergence, dette technique |
| Monorepo avec workspaces npm | **Exclue pour l’instant** | Nécessite de migrer toutes les applications dans un seul depot ; trop invasif |
| Git submodule | **Exclue** | Fragile, historique dissocie, difficile a versionner proprement |
| Git subtree | **Exclue** | Complexe, source d’erreurs de merge, pas adapte a un produit avec releases |
| Package npm public | **Exclue pour l’instant** | La licence et le positionnement produit ne sont pas encore arretes |
| Package npm prive GitHub Packages | **Recommandee** | Bon equilibre controle, simplicite, integration standard |

### Configuration attendue

Dans `package.json` :

```json
{
  "name": "@opaystech/oip",
  "publishConfig": {
    "access": "restricted",
    "registry": "https://npm.pkg.github.com"
  }
}
```

Dans `.npmrc` du consommateur :

```ini
@opaystech:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

### Exemple d’utilisation chez un consommateur

```json
{
  "dependencies": {
    "@opaystech/oip": "0.3.0-beta.1"
  }
}
```

```ts
import { OipRuntime } from "@opaystech/oip";
import { defineCapability } from "@opaystech/oip/core";
```

## Etapes d’activation (non realisees dans ce PI)

1. Configurer l’authentification GitHub Packages pour l’organisation `opaystech-stack`.
2. Ajouter un workflow `.github/workflows/publish.yml` qui publie sur tag `v*`.
3. Documenter l’installation dans `docs/oip-sdk-developer.md`.
4. Valider la publication avec un tag `v0.1.0-alpha`.
5. Migrer la premiere application pilote vers le package.

## Gestion des versions chez les consommateurs

- Les applications **pilotes** peuvent utiliser des prereleases en pinnant exactement (`0.3.0-beta.1`).
- Les applications **en production** doivent utiliser une version stable et tester la montee de version dans un environnement isole.
- Les montees de version MAJOR d’OIP doivent faire l’objet d’un plan de migration dedie.

## Points de vigilance

- **Licence** : la publication packagee necessite un choix de licence definitif. Le placeholder actuel doit etre remplace avant `v1.0.0`.
- **Secrets** : le token de publication GitHub Packages doit etre stocke dans les secrets du depot, jamais dans le code.
- **Dependances** : OIP a actuellement zero dependance runtime. Cette propriete doit etre preservee autant que possible.

## Conclusion

La distribution par **package npm prive sur GitHub Packages** est l’approche la plus adaptee au contexte Opays : elle preserve l’autonomie d’OIP, s’integre nativement a l’existant GitHub, et permet a chaque application de controler sa version sans complexifier son architecture.
