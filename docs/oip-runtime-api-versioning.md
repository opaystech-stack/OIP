# Stratégie officielle de versionnement de l'API publique OIP

Version : `1.0.0`  
Statut : Contrat officiel — API Readiness Program WS-3  
Date : 2026-07-09

---

## 1. Principe

L'API publique OIP est versionnée globalement. Une seule version majeure du contrat public est supportée à la fois par défaut, mais OIP peut maintenir deux versions majeures en parallèle pendant une période de transition.

> **Règle absolue** : une fois qu'une opération est marquée `stable` dans une version majeure, sa signature publique ne change plus dans cette version.

---

## 2. Format de version

Le contrat public suit une forme simplifiée de SemVer :

```text
MAJOR.MINOR
```

Exemple : `v1.0`, `v1.1`, `v2.0`.

- **MAJOR** : changement incompatible du contrat public.
- **MINOR** : ajout d'opérations ou de champs optionnels sans rupture.

Le terme `v1` désigne la famille `v1.x`.

---

## 3. Cycle de vie d'une opération

```text
Draft → Stable → Deprecated → Removed
```

### 3.1 Draft

- L'opération est proposée.
- Elle peut être testée par des consommateurs pilotes.
- Elle n'est pas garantie stable.
- Elle n'est pas incluse par défaut dans la documentation publique principale.

### 3.2 Stable

- L'opération est validée par l'API Readiness Review ou le comité de gouvernance.
- Sa signature est figée pour la durée de vie de la version majeure.
- Elle est documentée et testée dans la Validation Suite.

### 3.3 Deprecated

- L'opération est toujours fonctionnelle mais son remplaçant existe dans la version courante ou la suivante.
- Les appels retournent un avertissement (`warning`) dans la réponse.
- La documentation indique la nouvelle opération à utiliser.

### 3.4 Removed

- L'opération n'est plus disponible.
- Elle retourne `operation.not-found`.
- Elle ne peut être removed que dans une nouvelle version majeure.

---

## 4. Règles de montée de version

### 4.1 Changement autorisé sans nouvelle version majeure

- Ajouter une opération (passe de `draft` à `stable` dans la même version mineure).
- Ajouter un champ **optionnel** à une requête ou une réponse.
- Ajouter une valeur à une énumération publique de chaînes.
- Ajouter un code d'erreur.
- Ajouter un champ optionnel dans un type public.

### 4.2 Changement nécessitant une nouvelle version majeure

- Modifier un champ obligatoire.
- Supprimer un champ.
- Renommer un type, une opération ou un champ.
- Changer le type d'un champ.
- Retirer une opération publique.
- Modifier le sens d'une opération.

---

## 5. Coexistence des versions majeures

### 5.1 Principe

OIP supporte au maximum **deux versions majeures en parallèle** : la version courante (Current) et la version précédente (Previous).

### 5.2 Règles

- Lors du lancement de `v2`, `v1` reste disponible pendant **12 mois** minimum.
- Les nouvelles opérations ne sont ajoutées que dans la version Current.
- Les correctifs de sécurité sont appliqués à Current et Previous.
- Les opérations `deprecated` dans Previous ne sont pas re-dépréciées ; elles restent utilisables jusqu'au retrait.

### 5.3 Sélection de version par le client

#### SDK

```typescript
const client = OipPublicClient.create({ version: "v1" });
```

#### HTTP

```text
POST /v1/oip/invoke
POST /v2/oip/invoke
```

La version est également transmise dans l'en-tête :

```text
X-Oip-Api-Version: v1
```

Si l'en-tête et le chemin sont en contradiction, le chemin prime.

### 5.4 Version par défaut

Si aucune version n'est spécifiée, la version Current est utilisée.

---

## 6. Dépréciation

### 6.1 Notification

La dépréciation d'une opération est annoncée :

- dans la documentation officielle ;
- dans la réponse de l'opération (`metadata.warnings`) ;
- dans le changelog d'OIP ;
- par un ADR dédié si l'opération est largement utilisée.

### 6.2 Durée de dépréciation

- Une opération reste `deprecated` pendant au moins **6 mois** avant d'être `removed`.
- Elle ne peut être `removed` que lors d'une montée de version majeure.

---

## 7. Communication aux consommateurs

Chaque nouvelle version majeure est accompagnée de :

- un guide de migration ;
- une liste des opérations modifiées, dépréciées ou retirées ;
- une période de support communiquée pour la version Previous.

---

## 8. Versionnement interne vs public

- Les versions internes des packages OIP (`@opaystech/oip@0.1.0-alpha`) suivent leur propre cycle.
- Le contrat public (`v1`, `v2`) est indépendant des versions internes.
- Un package interne peut passer en `v0.5.0` alors que le contrat public reste `v1`.

---

## 9. Références

- `docs/oip-runtime-api-public-types.md`
- `docs/oip-runtime-api-contract.md`
- `docs/oip-runtime-api-security.md`
- `docs/oip-runtime-api-governance.md`
- `docs/oip-runtime-api-examples.md`
- `docs/adr/adr-009-runtime-public-api.md`
- `docs/oip-api-readiness-program.md`
- `docs/architecture-reviews/ar-002-api-readiness-review.md`
- MB-001 — Pre-Flight API Validation
