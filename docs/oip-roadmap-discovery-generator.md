# Feuille de route incrémentale — Discovery et Generator

Cette feuille de route permet d'introduire les piliers Discovery et Generator dans OIP sans casser le Runtime existant.

---

## Principe

- Le **Runtime** reste la fondation stable.
- Les piliers sont ajoutés sous forme de packages indépendants.
- Chaque étape livre une valeur concrète et testable.
- Aucune étape ne modifie le Runtime existant.

---

## Phase 0 — Fondation (terminée)

- ✅ Manifest d'intégration versionné.
- ✅ JSON Schema officiel.
- ✅ ADR-005, ADR-006, ADR-007, ADR-008.
- ✅ RFC-001 sur les contrats publics.
- ✅ Documentation des rôles Discovery / Generator / Runtime.

---

## Phase 1 — Package `manifest` (court terme)

Objectif : extraire la définition et la validation du Manifest dans un package dédié.

- Créer `packages/manifest`.
- Définir les types TypeScript du Manifest.
- Implémenter la validation de schéma.
- Implémenter la validation de compatibilité OIP.
- Implémenter la validation sémantique.
- Publier via `@opaystech/oip/manifest`.

Livrable : un package réutilisable par Discovery, Generator et Runtime.

---

## Phase 2 — Package `discovery` — lecteur de structure (court terme)

Objectif : analyser un dépôt et produire un Manifest initial simple.

- Créer `packages/discovery`.
- Implémenter `ApplicationReader` pour Node.js.
- Extraire : modules, services, routes, dépendances.
- Générer un `opays.manifest.yaml` de base.
- Générer un rapport d'analyse.

Livrable : commande `oip discover --source ./app --output ./proposal`.

---

## Phase 3 — Package `generator` — templates de base (moyen terme)

Objectif : générer une application minimale à partir d'un Manifest.

- Créer `packages/generator`.
- Implémenter le moteur de templates.
- Générer : backend Node.js, plugin OIP, adaptateurs vides, tests.
- Copier le Manifest dans le projet généré.

Livrable : commande `oip generate --manifest opays.manifest.yaml --output ./generated/app`.

---

## Phase 4 — Intégration Discovery + Generator (moyen terme)

Objectif : permettre le cycle complet existant → Manifest → codebase.

- Connecter Discovery et Generator via le Manifest.
- Valider un projet généré avec le Runtime existant.
- Documenter le cycle complet.

Livrable : guide "De la codebase existante à la nouvelle application générée".

---

## Phase 5 — Premier pilote Opays-HQ (long terme)

Objectif : appliquer le cycle sur une application réelle.

- Lancer Discovery sur Opays-HQ.
- Valider le Manifest avec l'équipe.
- Générer la structure cible.
- Écrire le Blueprint de migration.
- Activer le Shadow Mode.
- Migrer progressivement les capabilities.

Livrable : application Opays-HQ intégrée nativement avec OIP.

---

## Phase 6 — Généralisation (long terme)

Objectif : industrialiser Discovery et Generator pour toutes les applications Opays.

- Support de multiples stacks (Node.js, Python, etc.).
- Templates enrichis (frontend, Docker, CI/CD).
- Plugins de templates personnalisables.
- Validation automatique dans la CI de chaque application.

Livrable : OIP devient la plateforme officielle de conception, génération et intégration.

---

## Principes de mise en œuvre

- Chaque phase commence par la conception et la validation.
- Chaque phase se termine par des tests.
- Aucune phase ne modifie le Runtime sans ADR.
- Le Manifest reste le contrat central à chaque étape.

---

## Références

- `docs/oip-three-pillars-architecture.md`
- `docs/oip-target-package-structure.md`
- `docs/oip-discovery-role.md`
- `docs/oip-generator-role.md`
- `docs/rfc/rfc-001-discovery-generator-runtime-contracts.md`
- `docs/adr/adr-006-oip-three-pillars.md`
- `docs/adr/adr-007-generator.md`
- `docs/adr/adr-008-discovery.md`
