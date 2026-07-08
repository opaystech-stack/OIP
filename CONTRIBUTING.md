# Contributing to OIP

Merci de contribuer a OIP. Ce document fixe les regles minimales pour maintenir le projet comme un produit stable et reutilisable.

## Principe directeur

OIP est un **actif technologique autonome**, pas une partie d’une application metier.  
Chaque contribution doit renforcer sa capacite a etre versionne, publie et integre sans remettre en cause la stabilite des consommateurs.

## Avant de commencer

1. Lire `docs/oip-vision-architecture.md`, `docs/oip-capability-contract.md` et `docs/oip-sdk-developer.md`.
2. Ouvrir une issue decrivant le besoin concret, la solution envisagee et les risques.
3. Si la contribution introduit une nouvelle abstraction, Runtime ou concept, ecrire un ADR dans `docs/adr/`.

## Workflow Git

1. Forker le depot (contributeurs externes) ou creer une branche depuis `main` (contributeurs internes).
2. Nommer la branche `feat/<description>`, `fix/<description>` ou `docs/<description>`.
3. Commiter avec des messages au format : `type(scope): description courte`.
4. Ouvrir une Pull Request en remplissant le template.
5. S’assurer que la CI passe (`npm run test:all`).
6. Demander une review. Une PR ne peut etre mergee sans au moins une approbation.

## Conventions de code

- TypeScript strict, module `NodeNext`, ES2022.
- Pas de dependance externe sans justification explicite dans l’ADR/PR.
- Chaque contrat public doit avoir des tests.
- Chaque bug fixe doit avoir un test de regression.
- Pas d’import direct d’implementation externe depuis `packages/core`.

## Tests

```bash
npm run check      # type check sans emission
npm run test:all   # suite complete
npm run demo       # demo commerce
npm run demo:api   # demo API
```

Un commit ne doit jamais casser `npm run test:all`.

## API publique

- Les exports stables sont documentes dans `docs/oip-sdk-developer.md`.
- Tout symbole non exporte par `@opaystech/oip`, `@opaystech/oip/core`, `@opaystech/oip/plugin-sdk`, `@opaystech/oip/config`, `@opaystech/oip/llm-adapter` ou `@opaystech/oip/adapters` est interne.
- Avant de rendre un symbole public, s’assurer qu’il est teste, nomme de maniere stable et justifie par un besoin consommateur reel.

## Release process

Voir `docs/oip-versioning.md`.  
Seuls les mainteneurs peuvent pousser un tag de version et publier sur GitHub Packages.

## Code de conduite

Voir [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

## Questions

Ouvrir une issue avec le label `question` ou contacter l’equipe OIP via les canaux internes.
