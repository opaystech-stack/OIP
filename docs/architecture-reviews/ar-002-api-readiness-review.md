---
status: ready
date: 2026-07-09
title: AR-002 — API Readiness Review finale
program: API Readiness Program
verdict: READY
---

# AR-002 — API Readiness Review finale

## 1. Contexte

Cette revue conclut l'**API Readiness Program**. Les six workstreams ont produit leurs contrats définitifs. L'objectif est de déterminer si le contrat public d'OIP est suffisamment mature pour être implémenté.

---

## 2. Documents d'entrée

Les documents suivants ont été produits et sont considérés comme les contrats officiels de référence :

- [x] `docs/adr/adr-009-runtime-public-api.md`
- [x] `docs/oip-runtime-api-contract.md` (WS-2)
- [x] `docs/oip-runtime-api-public-types.md` (WS-1)
- [x] `docs/oip-runtime-api-versioning.md` (WS-3)
- [x] `docs/oip-runtime-api-security.md` (WS-4)
- [x] `docs/oip-runtime-api-governance.md` (WS-5)
- [x] `docs/oip-runtime-api-examples.md` (WS-6)
- [x] `docs/oip-api-readiness-program.md`
- [x] `docs/architecture-reviews/ar-001-runtime-public-api.md`

---

## 3. Critères de READY

| # | Critère | Preuve | État |
|---|---|---|---|
| R1 | Types publics formalisés | `docs/oip-runtime-api-public-types.md` ✅ | OK |
| R2 | Catalogue d'opérations finalisé | `docs/oip-runtime-api-contract.md` ✅ | OK |
| R3 | Stratégie de versionnement complète | `docs/oip-runtime-api-versioning.md` ✅ | OK |
| R4 | Modèle de sécurité validé | `docs/oip-runtime-api-security.md` ✅ | OK |
| R5 | Gouvernance du catalogue en place | `docs/oip-runtime-api-governance.md` ✅ | OK |
| R6 | Exemples par transport complets | `docs/oip-runtime-api-examples.md` ✅ | OK |
| R7 | Cohérence transversale vérifiée | Terminologie alignée, mêmes identifiants d'opérations | OK |
| R8 | Aucune ambiguïté bloquante | Distinction `plan/decide`, `knowledge.ingest` officialisée | OK |

---

## 4. Synthèse de la revue

### 4.1 Cohérence

- Le catalogue contient 21 opérations publiques réparties en 11 domaines.
- Aucune redondance bloquante n'a été identifiée.
- La distinction `decision.plan` / `decision.decide` est claire et justifiée.
- `knowledge.ingest` est officialisée comme opération publique unique ; le service `documents` interne reste caché.

### 4.2 Stabilité

- Les types publics (`RuntimeContext`, `JsonObject`, `JsonValue`, `JsonArray`) sont figés.
- Les types d'opérations sont indépendants des types internes.
- Les règles d'évolution permettent des ajouts optionnels sans casser la compatibilité.

### 4.3 Sécurité

- Authentification externalisée par transport.
- Autorisation multi-niveaux : transport, `PolicyRuntime`, `Validator`, `CapabilityDefinition`.
- Scopes, rôles, rate limiting, quotas et audit définis.
- Modèle de menaces et erreurs de sécurité documentés.

### 4.4 Versionnement

- Versionnement global `v1`, `v2`.
- Règles de changement avec/sans nouvelle version majeure.
- Coexistence de deux versions majeures pendant 12 mois.
- Cycle de vie des opérations : `draft` → `stable` → `deprecated` → `removed`.

### 4.5 Gouvernance

- Processus d'ajout d'opération avec 7 critères d'acceptation.
- Comité de gouvernance défini.
- Dépréciation et retrait encadrés.
- Traçabilité jusqu'à une justification métier.

### 4.6 Transports

- Exemples SDK, HTTP, CLI, MCP, Automation fournis.
- Même contrat public pour tous les transports.
- Mapping opération/transport complet.

---

## 5. Points d'attention acceptés

Les points suivants sont identifiés mais ne bloquent pas le verdict READY. Ils seront traités pendant l'implémentation :

1. **Validation de l'expérience développeur** : les premiers consommateurs SDK/HTTP pourront faire évoluer les payloads mineurs sans rupture.
2. **Choix exact du protocole SSE/WebSocket** : le support de `events.subscribe` en mode streaming sera validé par prototype.
3. **Détail des signatures de webhooks** : le secret et l'algorithme seront choisis lors de l'implémentation.
4. **Rate limiting par défaut** : les valeurs actuelles sont des recommandations ; elles seront configurables.
5. **Format des traces techniques** : les champs `metadata` des traces pourront être enrichis sans rupture.

---

## 6. Verdict

### ✅ READY

Le contrat public d'OIP est jugé suffisamment mature, stable et générique pour devenir l'API publique officielle de la plateforme.

### Conséquences du verdict READY

1. L'**ADR-009 passe à `Accepted`**.
2. L'**implémentation de l'API publique** est autorisée dans OIP.
3. Les développements peuvent commencer selon `docs/oip-runtime-api-implementation-plan.md`.
4. Le **blocage de MB-001 dans Opays-HQ** sera levé dès que :
   - l'API HTTP est opérationnelle ;
   - le SDK public est publié ;
   - la Validation Suite couvre les opérations publiques ;
   - la documentation de mise en œuvre est disponible.

### Option NOT READY

Non retenue. Aucun point bloquant n'a été identifié.

---

## 8. Résultat de la revue

| Élément | Valeur |
|---|---|
| Date de la revue | 2026-07-09 |
| Participants | Équipe OIP (revue interne formelle) |
| Verdict | **READY** |
| Points bloquants | Aucun |
| Points d'attention | 5 points mineurs à traiter pendant l'implémentation |
| Décision suite | Accepter ADR-009 ; lancer l'implémentation de l'API publique |

## 9. Conditions de déblocage de MB-001

Le verdict READY autorise l'implémentation dans OIP. Le blocage de MB-001 dans Opays-HQ sera levé uniquement lorsque les conditions suivantes seront remplies :

1. L'API HTTP publique (`POST /v1/oip/invoke`) est opérationnelle.
2. Le SDK public (`@opaystech/oip/public`) est publié et testé.
3. La Validation Suite couvre les opérations publiques critiques pour Opays-HQ (`llm.generateText`, `decision.decide`, `actions.execute`, etc.).
4. La documentation de mise en œuvre pour les consommateurs est disponible.

Avant cela, **Opays-HQ reste officiellement bloqué sur MB-001** et aucun développement applicatif ne reprend.

---

## 10. Références

- `docs/oip-api-readiness-program.md`
- `docs/architecture-reviews/ar-001-runtime-public-api.md`
- `docs/adr/adr-009-runtime-public-api.md`
- `docs/oip-runtime-api-contract.md`
- `docs/oip-runtime-api-public-types.md`
- `docs/oip-runtime-api-versioning.md`
- `docs/oip-runtime-api-security.md`
- `docs/oip-runtime-api-governance.md`
- `docs/oip-runtime-api-examples.md`
- MB-001 — Pre-Flight API Validation
