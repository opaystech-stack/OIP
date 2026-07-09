# Analyse des risques — API publique des Runtime OIP

Version : `1.0.0-draft`  
Statut : Document d'étude  
Date : 2026-07-09

---

## 1. Risques identifiés

### R1 — Le contrat public devient trop vaste

**Description** : la tentation est grande d'exposer trop d'opérations, ce qui rend la facade aussi difficile à maintenir que l'option A (API par Runtime).

**Impact** : élevé.
**Probabilité** : moyenne.
**Mitigation** :
- N'exposer que les opérations demandées par au moins deux consommateurs.
- Toute nouvelle opération passe par une revue d'architecture.
- Les opérations internes restent internes.

### R2 — Instabilité des Runtimes internes

**Description** : les Runtimes existants sont des implémentations en mémoire ou des stubs. Leur contrat peut évoluer avant de devenir stable.

**Impact** : élevé.
**Probabilité** : moyenne.
**Mitigation** :
- Le routeur adapte les Runtimes au contrat public ; les consommateurs ne dépendent pas directement des Runtimes.
- Ne pas marquer `stable` une opération dont le Runtime sous-jacent n'est pas validé.
- Attendre la Validation Suite avant de figer une opération.

### R3 — Le routeur devient un nouvel empilement complexe

**Description** : le routeur centralise la logique d'appel aux Runtimes et risque d'accumuler des règles métier.

**Impact** : moyen.
**Probabilité** : moyenne.
**Mitigation** :
- Le routeur ne fait que router ; il ne contient pas de logique métier.
- Les règles de sécurité et de validation restent dans les Runtimes.
- Auditer régulièrement la taille du routeur.

### R4 — L'authentification est insuffisamment définie

**Description** : la facade reçoit un `RuntimeContext`, mais le mécanisme d'authentification reste transport-spécifique.

**Impact** : élevé.
**Probabilité** : moyenne.
**Mitigation** :
- Fournir des adaptateurs d'authentification exemples.
- Documenter les responsabilités de chaque couche.
- Exiger une revue sécurité avant la mise en production de l'API HTTP.

### R5 — Versionnement mal géré

**Description** : ajouter des opérations sans respecter la version globale peut créer des incompatibilités.

**Impact** : moyen.
**Probabilité** : moyenne.
**Mitigation** :
- Règle stricte : `v1` reste figée sur les signatures.
- Nouvelle opération = patch `v1.x` si elle est additive.
- Changement de signature = `v2`.
- Tests de compatibilité rétroactive dans la Validation Suite.

### R6 — Opays-HQ attend l'implémentation HTTP

**Description** : Opays-HQ est bloqué sur MB-001 tant que l'API HTTP n'est pas implémentée.

**Impact** : élevé pour le projet pilote.
**Probabilité** : certaine.
**Mitigation** :
- Livrer d'abord le SDK local (Phase 3) pour permettre des tests internes rapides.
- Livrer ensuite le serveur HTTP minimal (Phase 4).
- Communiquer clairement la séquence de déblocage.

### R7 — Mauvaise séparation entre SDK et API HTTP

**Description** : si le SDK et l'API HTTP ont des contrats différents, les consommateurs seront fragmentés.

**Impact** : moyen.
**Probabilité** : moyenne.
**Mitigation** :
- Le SDK et l'API HTTP implémentent tous deux `OipPublicRuntimeApi`.
- Tests cross-transport dans la Validation Suite.

---

## 2. Matrice de risques

| Risque | Impact | Probabilité | Niveau | Mitigation principale |
|---|---|---|---|---|
| R1 — Facade trop vaste | Élevé | Moyenne | Élevé | Gouvernance stricte |
| R2 — Instabilité Runtimes | Élevé | Moyenne | Élevé | Routeur + stabilité |
| R3 — Routeur complexe | Moyen | Moyenne | Moyen | Router-only |
| R4 — Authentification | Élevé | Moyenne | Élevé | Adaptateurs documentés |
| R5 — Versionnement | Moyen | Moyenne | Moyen | Règles strictes |
| R6 — Attente Opays-HQ | Élevé | Certaine | Élevé | Phases 3 puis 4 rapides |
| R7 — Fragmentation SDK/HTTP | Moyen | Moyenne | Moyen | Contrat unique |

---

## 3. Hypothèses et conditions de succès

1. Les Runtimes internes ne sont pas modifiés pour cette architecture.
2. Le contrat public est validé par une revue d'architecture avant toute implémentation.
3. Opays-HQ accepte d'attendre le serveur HTTP de Phase 4, mais peut déjà utiliser le SDK de Phase 3.
4. La Validation Suite couvrira toutes les opérations publiques avant leur marquage `stable`.

---

## 4. Références

- `docs/oip-runtime-api-contract.md`
- `docs/oip-runtime-api-implementation-plan.md`
- `docs/adr/adr-009-runtime-public-api.md`
- MB-001
