# Plan d’integration d’OIP dans les applications existantes

## Principe

Aucune application metier n’est modifiee pendant ce Program Increment.  
Ce document propose la strategie de migration a executer **apres** qu’OIP aura atteint un niveau de maturite suffisant (beta minimum, idéalement stable).

## Objectif

Faire en sorte que la premiere integration d’OIP serve de **reference** pour toutes les suivantes :

- zero duplication de logique conversationnelle
- zero remise en cause de la stabilite de l’application
- validation progressive, rollback possible
- documentation de la migration reutilisable

## Applications concernees

| Application | Etat actuel | Complexite d’integration |
|---|---|---|
| **Gestion d’entreprise IA** | Avancee ou terminee avec logique conversationnelle propre | Moyenne |
| **Gestion Forex** | Avancee ou terminee avec logique conversationnelle propre | Moyenne |
| **Commerce** | Pas d’application standalone ; plugin OIP existe deja | Faible (reference) |
| **RH** | Pas d’application standalone ; plugin OIP existe deja | Faible |

## Ordre d’integration recommande

### Phase 1 — Reference interne : Commerce et HR via API OIP

Avant d’integrer une application reelle, utiliser les plugins **Commerce** et **RH** deja disponibles dans OIP pour valider l’integration end-to-end.

**Livrable** : une application de reference (playground) qui consomme OIP via HTTP ou package.

### Phase 2 — Premiere application reelle : Gestion d’entreprise IA

**Pourquoi en premier**

- C’est l’application la plus proche conceptuellement d’OIP (gestion, automatisation, decision).
- Elle a probablement deja des concepts de capabilities/permissions qu’il faut mapper.
- Son integration reussie fournit le patron pour toutes les autres.

### Phase 3 — Gestion Forex

**Pourquoi en deuxieme**

- Metier critique (financier, regule).
- L’experience acquise sur la gestion d’entreprise IA permet de mieux gerer les exigences de securite et de confirmation.
- Permet de valider OIP sur un domaine avec forte contrainte d’audit.

### Phase 4 — Autres produits Opays

Commerce, RH, Sante, Immobilier, ONG, Education, Logistique, Cadastre, Juridique.

## Strategie par application

### 1. Cartographie

Identifier dans l’application existante :

- Les points d’entree conversationnels (chat, commande vocale, formulaire intelligent).
- Les actions metier declenchées par langage naturel.
- Les regles de validation, permissions, confirmation.
- Les sources de connaissance (documents, procedures).
- Les evenements metiers emis.

### 2. Decoupage en capabilities

Chaque action metier conversationnelle devient une **capability OIP**.

Regles :

- Une capability = un verbe metier atomique.
- Les parametres sont types et valides par OIP.
- Les regles de permission (RBAC) sont portees par la capability, pas par le code applicatif.
- Les side-effects et evenements emis sont explicites.

### 3. Adaptateurs applicatifs

Pour chaque application, developper des **adaptateurs OIP** qui appellent les services metiers existants.

| Adaptateur | Role |
|---|---|
| `IdentityAdapter` | Resoudre l’utilisateur/workspace depuis l’application |
| `BusinessToolAdapter` | Appeler les services metiers de l’application depuis les tools OIP |
| `MemoryAdapter` | Persister la memoire conversationnelle dans la base de l’application |
| `AuditAdapter` | Ecrire les audits dans le systeme de logs de l’application |
| `EventAdapter` | Publier les evenements OIP dans le bus metier de l’application |
| `KnowledgeAdapter` | Connecter les documents/procedures metiers a `KnowledgeEngine` |

### 4. Coexistence puis remplacement

Ne pas supprimer l’ancien moteur conversationnel du jour au lendemain.

```text
Semaine 1-2 : OIP en parallele, shadow mode (resultats compares, non actifs)
Semaine 3-4 : OIP en mode opt-in pour certains utilisateurs / capabilities
Semaine 5-6 : Bascule progressive capability par capability
Semaine 7-8 : Suppression de l’ancien moteur pour les capabilities migrees
```

### 5. Supprimer / conserver / developper

#### Supprimer dans l’application

- Parser de langage naturel specifique.
- Regles de mapping texte → action metier.
- Systeme de confirmation ad-hoc.
- Bus d’evenements conversationnels specifique.

#### Conserver dans l’application

- Services metiers (pas touches).
- Modeles de donnees metiers.
- Authentification et gestion des utilisateurs.
- UI/UX conversationnelle.

#### Developper

- Plugin OIP de l’application (capabilities + tools).
- Adaptateurs OIP vers les services metiers.
- Configuration OIP (LLM, persistance, observabilite).
- Tests d’integration.

## Limitation des risques

| Risque | Mitigation |
|---|---|
| Regression fonctionnelle | Shadow mode + tests d’integration comparatifs |
| Fuite de donnees / permission | Validation OIP + mapping strict des roles |
| Dependance a une version alpha/beta | Pinner la version exacte, migrer vers stable des que possible |
| Performance | Benchmark avant/apres, cache de capabilities |
| Resistance au changement | Documentation, formation, premier cas pilote concret |

## Validation de chaque migration

1. **Tests unitaires** : chaque capability et tool teste.
2. **Tests d’integration** : flux complet utilisateur → action metier.
3. **Tests de non-regression** : comparaison ancien moteur / OIP sur un corpus de requetes.
4. **Tests de securite** : RBAC, confirmation, injection de prompts.
5. **Tests de charge** : latence et fiabilite sur le canal concerne.
6. **Validation metier** : recette par les utilisateurs finaux.

## Patron de migration reutilisable

Apres la premiere integration, produire un kit :

- `docs/integration-patterns/capability-mapping.md`
- `docs/integration-patterns/adapter-template.ts`
- `docs/integration-patterns/migration-checklist.md`
- Exemple de plugin minimal
- Configuration CI pour tester l’integration

## Conclusion

La premiere integration doit etre menee avec patience.  
Elle ne vise pas a livrer vite, mais a etablir un **patron reproductible** :

1. Cartographier.
2. Decouper en capabilities.
3. Developper les adaptateurs.
4. Coexister.
5. Basculer.
6. Supprimer l’ancien moteur.

Une fois ce patron valide, les migrations suivantes deviennent des applications mecaniques du meme modele.
