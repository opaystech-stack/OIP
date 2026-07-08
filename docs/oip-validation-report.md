# OIP Validation Suite Report

Date d’execution : 2026-07-08
Version OIP : `0.1.0-alpha`
Scenarios : 15
Resultat global : **15 passed / 0 partial / 0 failed**

## Objectif

Cette suite valide que le moteur OIP est capable de piloter des domaines metiers reels par le langage naturel : selection de la bonne Capability, gestion des permissions, confirmation, rejet et production d’un resultat coherent.

## Methodologie

- Chaque scenario simule une requete utilisateur.
- Un `MockLlmAdapter` injecte le `PlannedAction` attendu.
- Le moteur execute le plan via `OipRuntime.execute`.
- Le resultat est compare aux criteres d’acceptation.

Cette approche garantit la **reproductibilite** et le **determinisme** de la validation.

## Scenarios par domaine

### Commerce

| ID | Titre | Status |
|---|---|---|
| COMM-001 | Ajouter un produit au catalogue | ✅ passed |
| COMM-002 | Creer une facture | ✅ passed |
| COMM-003 | Enregistrer un paiement | ✅ passed |
| COMM-004 | Consulter le stock | ✅ passed |

### Gestion d’entreprise IA

| ID | Titre | Status |
|---|---|---|
| BIZ-001 | Creer un client | ✅ passed |
| BIZ-002 | Planifier une tache | ✅ passed |
| BIZ-003 | Generer un rapport | ✅ passed |

### Forex

| ID | Titre | Status |
|---|---|---|
| FX-001 | Enregistrer une operation de change | ✅ passed |
| FX-002 | Consulter un portefeuille | ✅ passed |
| FX-003 | Generer un rapport de performance | ✅ passed |

### Raisonnement

| ID | Titre | Status |
|---|---|---|
| REA-001 | Intention ambigue (confirmation requise) | ✅ passed |
| REA-002 | Permission insuffisante | ✅ passed |
| REA-003 | Action sensible sans confirmation | ✅ passed |
| REA-004 | Action sensible avec confirmation | ✅ passed |
| REA-005 | Demande impossible / non autorisee | ✅ passed |

## Criteres d’acceptation

Un scenario est `passed` si et seulement si :

1. La capability selectionnee correspond a la capability attendue.
2. Le statut d’execution (`completed` / `rejected`) correspond au statut attendu.
3. Les donnees de resultat contiennent les valeurs attendues (quand definies).

## Metriques

- **Taux de reussite** : 100 % (15/15)
- **Taux de reussite par domaine** : 100 % pour Commerce, Gestion IA, Forex, Raisonnement
- **Scenarios de raisonnement reussis** : 5/5

## Limites identifiees

Meme si la suite passe a 100 %, plusieurs limites reelles ont ete mises en evidence :

1. **Le moteur est totalement dependant de la qualite du plan LLM**
   - La suite utilise un `MockLlmAdapter` qui fournit des plans parfaits.
   - Avec un vrai LLM, la precision de selection de capability et d’extraction de parametres determinera la valeur metier reelle.
   - Recommandation : ajouter des tests avec un LLM reel des que possible.

2. **Le modele de roles est un AND, pas un OR**
   - `requiredRoles` exige que l’utilisateur possede **tous** les roles listes.
   - Cela peut surprendre les concepteurs de capabilities qui s’attendent a une logique de role alternatif.
   - Recommandation : documenter explicitement ce comportement ou supporter `anyOf` / `allOf`.

3. **La confirmation est binaire, sans granularite contextuelle**
   - Une capability `high` est bloquee jusqu’a ce que `confirmedCapabilities` la contienne.
   - Le moteur ne gere pas de dialogue de clarification automatique.
   - Recommandation : evoluer vers un runtime de clarification integre avant des cas metiers complexes.

4. **Aucun test de desambiguation par question utilisateur**
   - Le moteur rejette une demande ambigue (REA-001) via `confirmation_required`.
   - Il ne genere pas encore de question de clarification pour aider l’utilisateur.
   - Recommandation : implementer `DecisionRuntime.decide` de maniere a retourner `clarify` avec des candidates.

5. **Les outils simules ne verifient pas les preconditions metiers**
   - Par exemple, un paiement peut etre enregistre sur une facture inexistante.
   - Les outils de la suite sont des stubs ; la vraie robustesse viendra des adaptateurs metiers.
   - Recommandation : enrichir les scenarios avec des preconditions et des erreurs metiers dans une prochaine iteration.

6. **Determinisme garanti, mais a la condition d’injecter le LLM**
   - La reproducibilite est assuree par le `MockLlmAdapter`.
   - Des que le moteur utilise un LLM non deterministe, les resultats varieront.
   - Recommandation : mesurer la variance sur un LLM reel et definir des seuils d’acceptation.

## Recommandations avant version Beta

1. **Executer la Validation Suite avec un LLM reel** (OpenAI ou equivalent) pour mesurer le taux de reussite reel.
2. **Documenter le modele de roles** et eventuellement introduire `requiredRolesMode: "all" | "any"`.
3. **Ajouter des scenarios de desambiguation** avec retour `clarify` du moteur.
4. **Ajouter des scenarios d’erreurs metiers** (facture inexistante, stock insuffisant, solde negatif, etc.).
5. **Integrer la Validation Suite dans la CI** pour en faire un garde-fou permanent.
6. **Publier le package sur GitHub Packages** uniquement apres validation avec LLM reel.

## Conclusion

Sur des scenarios metiers representatifs et deterministes, OIP demontre qu’il peut :

- selectionner la bonne Capability ;
- valider les permissions ;
- exiger et honorer les confirmations ;
- rejeter proprement les actions non autorisees ;
- produire des evenements et des resultats structures.

La base fonctionnelle est **solide**. La prochaine etape critique est la validation avec un LLM reel pour confirmer que le moteur conserve ces performances dans des conditions non simulees.
