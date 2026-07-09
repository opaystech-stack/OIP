# API Readiness Program

Version : `1.0.0`  
Statut : Lancé  
Date : 2026-07-09  
Objectif : Transformer l'ADR-009 en un contrat public officiellement implémentable et durable.

---

## 1. Contexte

L'Architecture Review AR-001 a conclu que l'ADR-009 — API publique stable des Runtime OIP via une facade unique — est **architecturalement cohérente**, mais **NOT READY** pour implémentation. Six conditions de maturité ont été identifiées.

Ce programme regroupe ces six conditions en un unique effort structuré : l'**API Readiness Program**.

> **Principe fondateur** : OIP ne sera pas seulement une bibliothèque technique. Il deviendra la plateforme publique sur laquelle toutes les applications Opays s'appuieront. Cette transformation justifie une exigence accrue avant la moindre ligne de code.

---

## 2. Objectifs du programme

1. Produire une **version READY** du contrat public d'OIP.
2. Faire de la facade `OipPublicRuntimeApi` un contrat stable, sécurisé, versionné et gouverné.
3. Fournir tous les artefacts nécessaires à l'implémentation future : types publics, contrats par opération, modèle de sécurité, gouvernance, exemples par transport.
4. Organiser une **API Readiness Review finale** qui émettra un verdict explicite `READY` ou `NOT READY`.

---

## 3. Workstreams

Le programme regroupe les six conditions de l'AR-001 en six workstreams cohérents.

### WS-1 — Types publics

**Livrable :** `docs/oip-runtime-api-public-types.md`

**Contenu :**
- Formalisation de `RuntimeContext` comme contrat public.
- Formalisation de `JsonObject`, `JsonValue`, `JsonArray`.
- Définition des types spécifiques d'opérations : `LlmMessage`, `MemoryEntry`, `MemoryQuery`, `DomainEvent`, `PolicyRequest`, etc.
- Règles d'évolution des types publics (ajout de champs optionnels, extension d'énumérations).
- Mapping avec les types internes existants sans les exposer.

**Condition AR-001 associée :** condition 1.

---

### WS-2 — Clarification des opérations publiques

**Livrable :** mise à jour de `docs/oip-runtime-api-contract.md`

**Contenu :**
- Clarification de `events.subscribe` : modèle de livraison (SSE, webhook, polling), gestion des subscriptions, désabonnement.
- Distinction explicite entre `decision.plan` (proposition d'un plan structuré) et `decision.decide` (évaluation d'intention).
- Fusion ou séparation de `knowledge.ingest` et du service documents existant.
- Définition du cycle de vie des opérations sensibles (`actions.execute`, `actions.confirm`).
- Catalogue final validé avec, pour chaque opération : identifiant, domaine, description, responsable, types d'entrée/sortie, opérations liées.

**Condition AR-001 associée :** condition 2.

---

### WS-3 — Versionnement et dépréciation

**Livrable :** `docs/oip-runtime-api-versioning.md`

**Contenu :**
- Stratégie de version globale (`v1`, `v2`).
- Règles de coexistence de versions en parallèle.
- Politique de durée de vie : `draft` → `stable` → `deprecated` → `removed`.
- Communication aux consommateurs (migration guides, annonces).
- Règles de montée de version : quand passer de `v1` à `v2` ?
- Gestion des opérations additives dans une version mineure.

**Condition AR-001 associée :** condition 3.

---

### WS-4 — Modèle de sécurité

**Livrable :** `docs/oip-runtime-api-security.md`

**Contenu :**
- Authentification : construction du `RuntimeContext` par transport (SDK local, HTTP, CLI, MCP).
- Autorisation : rôles, scopes, permissions par opération.
- Rate limiting et quotas.
- Audit de sécurité : quoi tracer, où, comment longtemps.
- Gestion du streaming et des subscriptions sécurisées.
- Validation de tokens, secrets, chiffrement en transit.
- Modèle de menaces pour les opérations sensibles (`actions.execute`, `llm.generateText`, `memory.recall`).

**Condition AR-001 associée :** condition 4.

---

### WS-5 — Gouvernance du catalogue d'opérations

**Livrable :** `docs/oip-runtime-api-governance.md`

**Contenu :**
- Processus d'ajout d'une opération publique.
- Critères d'acceptation : au moins deux consommateurs, Validation Suite, revue sécurité, revue d'architecture.
- Rôles et responsabilités : qui propose, qui valide, qui maintient.
- Règles de retrait ou de dépréciation.
- Comité de gouvernance de l'API publique.
- Traçabilité : chaque opération publique a un ADR ou une justification.

**Condition AR-001 associée :** condition 5.

---

### WS-6 — Exemples de contrats par transport

**Livrable :** `docs/oip-runtime-api-examples.md`

**Contenu :**
- Exemples de payloads pour chaque opération critique.
- Exemple SDK local (`OipPublicClient`).
- Exemple API HTTP (`POST /v1/oip/invoke`).
- Exemple CLI (`oip invoke llm.generateText ...`).
- Exemple MCP (mapping d'outils).
- Exemple Automation (déclencheur + action).
- Erreurs typiques et réponses associées.

**Condition AR-001 associée :** condition 6.

---

## 4. Séquence et dépendances

```text
WS-1 : Types publics
    ↓
WS-2 : Clarification des opérations
    ↓
WS-3 : Versionnement
    ↓
WS-4 : Sécurité
    ↓
WS-5 : Gouvernance
    ↓
WS-6 : Exemples par transport
    ↓
API Readiness Review finale
    ↓
    READY  → implémentation de l'API publique dans OIP
    NOT READY → nouvelle itération du programme
```

**Dépendances justifiées :**

- WS-2 ne peut pas figer les types d'entrée/sortie sans WS-1.
- WS-3 dépend des opérations et de leurs types.
- WS-4 sécurise les opérations et le transport ; il dépend donc de WS-2 et WS-3.
- WS-5 gouverne l'ensemble, donc dépend de WS-1 à WS-4.
- WS-6 illustre le contrat final, donc dépend de tous les autres.

---

## 5. API Readiness Review finale

### 5.1 Objectif

Conclure explicitement si le contrat public est **READY** ou **NOT READY** pour implémentation.

### 5.2 Documents d'entrée

- `docs/adr/adr-009-runtime-public-api.md` (mis à jour si nécessaire)
- `docs/oip-runtime-api-contract.md` (mis à jour)
- `docs/oip-runtime-api-public-types.md` (WS-1)
- `docs/oip-runtime-api-versioning.md` (WS-3)
- `docs/oip-runtime-api-security.md` (WS-4)
- `docs/oip-runtime-api-governance.md` (WS-5)
- `docs/oip-runtime-api-examples.md` (WS-6)
- `docs/architecture-reviews/ar-001-runtime-public-api.md`

### 5.3 Critères de READY

| # | Critère | Preuve |
|---|---|---|
| R1 | Types publics formalisés | Document WS-1 approuvé |
| R2 | Catalogue d'opérations finalisé | Document WS-2 approuvé |
| R3 | Stratégie de versionnement complète | Document WS-3 approuvé |
| R4 | Modèle de sécurité validé | Document WS-4 approuvé + revue sécurité |
| R5 | Gouvernance du catalogue en place | Document WS-5 approuvé |
| R6 | Exemples par transport complets | Document WS-6 approuvé |
| R7 | Cohérence transversale vérifiée | Tous les documents alignés sur les mêmes termes |
| R8 | Aucune ambiguïté bloquante | Revue exhaustive sans point ouvert majeur |

### 5.4 Processus de la revue

1. Lecture indépendante des documents par les relecteurs.
2. Session de revue formelle avec liste de questions.
3. Traitement des retours.
4. Vote explicite : `READY` ou `NOT READY`.
5. Si `READY`, mise à jour de l'ADR-009 à `Accepted`.
6. Si `NOT READY`, liste des points bloquants et plan d'itération.

### 5.5 Gabarit

Le gabarit de la revue est disponible dans `docs/architecture-reviews/ar-002-api-readiness-review.md`.

---

Le programme est maintenant officiellement la dernière étape avant l'implémentation de l'API publique. La revue AR-002 a conclu **READY** ; l'implémentation est autorisée.

### État actuel du programme

- WS-1 ✅ — Types publics officiels produits.
- WS-2 ✅ — Contrat officiel des opérations publiques produit.
- WS-3 ✅ — Stratégie officielle de versionnement produite.
- WS-4 ✅ — Modèle officiel de sécurité produit.
- WS-5 ✅ — Gouvernance officielle du catalogue produite.
- WS-6 ✅ — Exemples officiels par transport produits.
- AR-002 ✅ — Verdict **READY** émis.

### Prochaine étape

L'implémentation de l'API publique dans OIP selon `docs/oip-runtime-api-implementation-plan.md`.

Lorsque le verdict `READY` sera prononcé :

1. L'implémentation de l'API publique sera lancée dans OIP.
2. Puis seulement, le blocage de MB-001 sera levé dans Opays-HQ.

## 6. Blocage d'Opays-HQ

Le verdict READY a été prononcé le 2026-07-09. L'implémentation de l'API publique dans OIP est autorisée. **Opays-HQ reste néanmoins bloqué sur MB-001 jusqu'à ce que l'API publique soit effectivement implémentée, testée, versionnée et documentée.**

Les conditions de déblocage exactes sont définies dans `docs/architecture-reviews/ar-002-api-readiness-review.md`, section 9.

---

## 7. Communication

Ce programme est le travail prioritaire d'OIP jusqu'à son verdict final. Toute demande d'évolution de l'API publique ou de nouveau Runtime pendant ce programme doit être intégrée à l'un des six workstreams, ou reportée après la revue.

---

## 8. Références

- `docs/adr/adr-009-runtime-public-api.md`
- `docs/architecture-reviews/ar-001-runtime-public-api.md`
- `docs/oip-runtime-api-contract.md`
- `docs/oip-pilot-applications.md`
- MB-001 — Pre-Flight API Validation
