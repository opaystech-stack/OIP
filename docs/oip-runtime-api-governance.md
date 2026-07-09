# Gouvernance officielle du catalogue d'opérations publiques OIP

Version : `1.0.0`  
Statut : Contrat officiel — API Readiness Program WS-5  
Date : 2026-07-09

---

## 1. Principe

Le catalogue d'opérations publiques d'OIP est gouverné. Chaque opération publique est une **décision architecturale** qui engage la stabilité de l'écosystème Opays.

> **Règle absolue** : aucune opération n'entre dans le catalogue public sans une justification métier explicite, une revue de sécurité et une validation formelle.

---

## 2. Structure du catalogue

Le catalogue officiel est défini dans `docs/oip-runtime-api-contract.md`. Il contient les opérations publiques actuellement validées.

Chaque opération est identifiée par :

- un identifiant unique (`domain.action`) ;
- un domaine (`llm`, `memory`, `events`, `context`, `decision`, `actions`, `knowledge`, `identity`, `policy`, `capabilities`, `audit`, `traces`) ;
- une version d'introduction (`v1` minimum) ;
- un statut de stabilité (`draft`, `stable`, `deprecated`, `removed`) ;
- une justification métier.

---

## 3. Processus d'ajout d'une opération publique

### 3.1 Étape 1 — Proposition

- Toute équipe peut proposer une nouvelle opération.
- La proposition inclut :
  - identifiant proposé ;
  - description du besoin ;
  - au moins deux consommateurs potentiels ;
  - payload et résultat préliminaires.

### 3.2 Étape 2 — Étude d'impact

- L'équipe OIP analyse :
  - la cohérence avec les opérations existantes ;
  - les impacts sécurité ;
  - la faisabilité technique sans exposer de type interne.

### 3.3 Étape 3 — Revue de sécurité

- Le modèle de sécurité de `docs/oip-runtime-api-security.md` est appliqué.
- Les scopes, rôles et risques sont documentés.

### 3.4 Étape 4 — Revue d'architecture

- Le comité de gouvernance de l'API publique examine la proposition.
- Il vérifie :
  - la stabilité à long terme ;
  - la compatibilité avec les transports existants ;
  - l'absence de redondance.

### 3.5 Étape 5 — Validation formelle

- L'opération est ajoutée au catalogue avec le statut `draft`.
- Elle est testée par au moins un consommateur pilote.
- Après succès, elle passe au statut `stable`.

---

## 4. Critères d'acceptation d'une opération

| # | Critère | Preuve |
|---|---|---|
| G1 | Au moins deux consommateurs identifiés | Document de justification |
| G2 | Types publics définis | `docs/oip-runtime-api-public-types.md` mis à jour |
| G3 | Sécurité documentée | `docs/oip-runtime-api-security.md` mis à jour |
| G4 | Versionnement clair | Version d'introduction et règles de dépréciation |
| G5 | Tests dans la Validation Suite | Scénarios de non-régression |
| G6 | Exemples par transport | `docs/oip-runtime-api-examples.md` mis à jour |
| G7 | Revue formelle acceptée | ADR ou minute de revue |

---

## 5. Dépréciation et retrait d'une opération

### 5.1 Dépréciation

- Une opération peut être dépréciée si un remplaçant existe.
- La dépréciation suit `docs/oip-runtime-api-versioning.md`.
- Durée minimale avant retrait : **6 mois**.

### 5.2 Retrait

- Une opération `removed` ne peut être atteinte que lors d'une montée de version majeure.
- Le retrait est validé par le comité de gouvernance.
- Un guide de migration est publié.

---

## 6. Rôles et responsabilités

### 6.1 Comité de gouvernance de l'API publique

- Valide les nouvelles opérations.
- Approuve les dépréciations et retraits.
- Réunit les architectes OIP, le responsable sécurité et un représentant produit.

### 6.2 Équipe OIP

- Maintient les documents officiels.
- Implémente le routeur public.
- Met à jour la Validation Suite.

### 6.3 Consommateurs

- Utilisent les opérations publiques.
- Signalent les anomalies et les besoins d'évolution.
- Ne peuvent pas forcer l'ajout d'une opération sans passer par le processus.

---

## 7. Traçabilité

Chaque opération publique doit être traçable jusqu'à :

- une justification métier ;
- une revue formelle ;
- un ensemble de tests ;
- une décision de gouvernance.

Le catalogue dans `docs/oip-runtime-api-contract.md` est la source de vérité.

---

## 8. Fréquence de revue

- Le catalogue est revu à chaque proposition d'opération.
- Une revue globale est organisée à chaque version mineure.
- Une revue stratégique est organisée à chaque version majeure.

---

## 9. Références

- `docs/oip-runtime-api-public-types.md`
- `docs/oip-runtime-api-contract.md`
- `docs/oip-runtime-api-versioning.md`
- `docs/oip-runtime-api-security.md`
- `docs/oip-runtime-api-examples.md`
- `docs/adr/adr-009-runtime-public-api.md`
- `docs/oip-api-readiness-program.md`
- `docs/architecture-reviews/ar-002-api-readiness-review.md`
- MB-001 — Pre-Flight API Validation
