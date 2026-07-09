---
status: pending
date: 2026-07-09
title: AR-002 — API Readiness Review finale
program: API Readiness Program
---

# AR-002 — API Readiness Review finale

## 1. Contexte

Cette revue est le point final de l'**API Readiness Program**. Elle doit conclure si le contrat public d'OIP est suffisamment mature pour être implémenté.

---

## 2. Documents d'entrée

Avant la revue, les documents suivants doivent être disponibles et à jour :

- [ ] `docs/adr/adr-009-runtime-public-api.md`
- [ ] `docs/oip-runtime-api-contract.md`
- [ ] `docs/oip-runtime-api-public-types.md` (WS-1)
- [ ] `docs/oip-runtime-api-versioning.md` (WS-3)
- [ ] `docs/oip-runtime-api-security.md` (WS-4)
- [ ] `docs/oip-runtime-api-governance.md` (WS-5)
- [ ] `docs/oip-runtime-api-examples.md` (WS-6)
- [ ] `docs/oip-api-readiness-program.md`
- [ ] `docs/architecture-reviews/ar-001-runtime-public-api.md`

---

## 3. Critères de READY

| # | Critère | Preuve | État |
|---|---|---|---|
| R1 | Types publics formalisés | WS-1 approuvé | ⬜ |
| R2 | Catalogue d'opérations finalisé | WS-2 approuvé | ⬜ |
| R3 | Stratégie de versionnement complète | WS-3 approuvé | ⬜ |
| R4 | Modèle de sécurité validé | WS-4 approuvé + revue sécurité | ⬜ |
| R5 | Gouvernance du catalogue en place | WS-5 approuvé | ⬜ |
| R6 | Exemples par transport complets | WS-6 approuvé | ⬜ |
| R7 | Cohérence transversale vérifiée | Alignement terminologique | ⬜ |
| R8 | Aucune ambiguïté bloquante | Liste des points ouverts vide | ⬜ |

---

## 4. Questions de revue

### Cohérence

- Les 21 opérations publiques sont-elles toutes nécessaires ?
- Y a-t-il des redondances ou des incohérences entre opérations ?
- Les types publics couvrent-ils tous les cas d'usage connus ?

### Stabilité

- Le contrat public peut-il rester inchangé pendant au moins 12 mois ?
- Les opérations marquées `stable` ont-elles toutes été validées ?
- Les types internes sont-ils correctement isolés derrière les types publics ?

### Sécurité

- Le modèle d'authentification est-il applicable à tous les transports ?
- Les scopes et permissions sont-ils définis pour chaque opération sensible ?
- Le rate limiting et les quotas sont-ils documentés ?
- L'audit de sécurité est-il conforme aux exigences Opays ?

### Versionnement

- La stratégie de version globale est-elle claire ?
- Les règles de coexistence de versions sont-elles réalisables ?
- La politique de dépréciation est-elle acceptable pour les consommateurs ?

### Gouvernance

- Le processus d'ajout d'une opération est-il suffisamment rigoureux sans être bloquant ?
- Les rôles et responsabilités sont-ils clairs ?
- Le catalogue est-il traçable jusqu'à une justification métier ?

### Transports

- Les exemples couvrent-ils SDK, HTTP, CLI, MCP et Automation ?
- Le même contrat est-il utilisable par tous les transports ?
- Les erreurs sont-elles cohérentes entre transports ?

---

## 5. Verdict

### Option 1 — READY

**Conditions :** tous les critères R1 à R8 sont satisfaits, aucun point bloquant.

**Conséquences :**
- ADR-009 passe à `Accepted`.
- Lancement de l'implémentation de l'API publique dans OIP.
- Le blocage de MB-001 dans Opays-HQ sera levé dès que l'API HTTP sera opérationnelle et testée.

### Option 2 — NOT READY

**Conditions :** au moins un critère R1 à R8 n'est pas satisfait, ou un point bloquant persiste.

**Conséquences :**
- Liste explicite des points bloquants.
- Plan d'itération du programme.
- Aucune implémentation de l'API publique.
- Opays-HQ reste bloqué sur MB-001.

---

## 6. Résultat de la revue

| Élément | Valeur |
|---|---|
| Date de la revue | À compléter |
| Participants | À compléter |
| Verdict | ⬜ READY / ⬜ NOT READY |
| Points bloquants (si NOT READY) | À compléter |
| Décision suite | À compléter |

---

## 7. Références

- `docs/oip-api-readiness-program.md`
- `docs/architecture-reviews/ar-001-runtime-public-api.md`
- `docs/adr/adr-009-runtime-public-api.md`
- MB-001 — Pre-Flight API Validation
