# Guide d'analyse pour générer et maintenir un Manifest OIP

Ce guide définit le processus officiel d'analyse d'une application destinée à être intégrée à OIP.

L'analyse ne produit **jamais** de modifications directes sur le Manifest validé. Elle génère une proposition que l'équipe humaine valide avant intégration.

---

## 1. Principe fondamental

> L'analyse automatique est un outil d'aide à la décision.
> Le Manifest validé reste la source de vérité.

---

## 2. Phase 1 — Analyse complète de la codebase

Objectif : comprendre l'application sans en modifier le moindre fichier.

### 2.1 Documents à lire

- `README.md` et documentation produit.
- Fichiers de configuration (package.json, tsconfig.json, pyproject.toml, etc.).
- Structure des dossiers.
- API routes ou contrôleurs.
- Modèles de données / entités.
- Services métiers et repositories.
- Points d'entrée conversationnels existants (chat, voice, commande).
- Composants liés au langage naturel (parser, routeur d'intentions, moteur de décision).

### 2.2 Questions à élucider

| Thème | Questions |
|---|---|
| Identité | Quel est le nom, le rôle et le périmètre fonctionnel de l'application ? |
| Modules | Quels sont les domaines métier principaux ? |
| Services | Quels services expose l'application ? |
| API | Quelles routes sont appelées par des interactions conversationnelles potentielles ? |
| Entrées IA | Existe-t-il un chat, un assistant vocal, des formulaires intelligents ? |
| Legacy IA | Quels composants pourraient être remplacés par OIP ? |
| Permissions | Quel système de rôles est utilisé ? |
| Données | Quelles bases de données et systèmes externes sont impliqués ? |
| Événements | Quel bus d'événements est utilisé ? |

### 2.3 Livrable de cette phase

Un rapport d'analyse structuré contenant :

- résumé de l'architecture ;
- liste des modules métier ;
- liste des services et endpoints pertinents ;
- points d'entrée IA existants ;
- composants legacy candidats au remplacement ;
- capacités métier détectées.

---

## 3. Phase 2 — Génération d'un premier Manifest

Si l'application ne possède pas encore de `opays.manifest.yaml`, l'analyse génère une proposition complète.

### 3.1 Règles de génération

- Chaque module métier détecté devient une entrée `modules`.
- Chaque service significatif devient une entrée `services`.
- Chaque route API conversationnelle ou actionnable devient une entrée `api.routes` avec `aiRelevant: true`.
- Chaque point d'entrée IA existant devient une entrée `aiEntrypoints`.
- Chaque composant NLP / routeur / moteur de décision maison devient une entrée `componentsToReplace`.
- Chaque action métier identifiable devient une `capability` avec son module, ses paramètres, ses rôles, son niveau de confirmation et son événement émis.
- Les adaptateurs nécessaires sont déduits des services existants et de l'architecture de persistance.

### 3.2 Convention de nommage des capabilities

```text
domaine.action.verb
```

Exemples :

- `business.customer.create`
- `business.task.schedule`
- `forex.operation.record`

### 3.3 Branche de proposition

Le Manifest initial est proposé dans une branche dédiée :

```text
feat/oip-manifest-init
```

 accompagné d'une pull request de revue.

---

## 4. Phase 3 — Détection des écarts avec un Manifest existant

Si un `opays.manifest.yaml` existe déjà, l'analyse ne le modifie pas. Elle produit un diff.

### 4.1 Étapes

1. Charger le Manifest existant.
2. Relire la codebase actuelle.
3. Construire un Manifest théorique à partir de la codebase.
4. Comparer les deux Manifests.
5. Produire un fichier `opays.manifest.proposed.yaml`.
6. Produire un rapport d'écarts.

### 4.2 Types d'écarts

| Type | Exemple |
|---|---|
| Ajout | Nouvelle route API, nouveau service, nouvelle capability |
| Suppression | Endpoint retiré, module fusionné |
| Modification | Changement de paramètres, de rôles, de confirmation |
| Incohérence | Capability référencée mais service absent |
| Obsolescence | Composant legacy déjà supprimé mais encore listé |

### 4.3 Protection des personnalisations manuelles

L'analyse doit identifier les sections qui semblent manuelles :

- champs avec `source: manual` ;
- commentaires explicites ;
- sections qui ne peuvent pas être déduites de la codebase.

Ces sections sont protégées : l'analyse ne les propose pas à la suppression automatique.

---

## 5. Phase 4 — Proposition du `opays.manifest.proposed.yaml`

### 5.1 Règles absolues

- Le Manifest validé n'est **jamais** écrasé.
- Le fichier proposé est nommé `opays.manifest.proposed.yaml`.
- Le fichier proposé contient un bloc `proposedChanges` listant chaque écart.
- Chaque écart est accompagné d'une justification et d'un niveau de confiance.

### 5.2 Exemple de section `proposedChanges`

```yaml
proposedChanges:
  - type: add
    section: capabilities
    item:
      id: business.report.export
      moduleId: reports
      description: Exporter un rapport au format PDF
      toolHandler: exportReport
    reason: Nouvelle route POST /api/reports/{id}/export détectée.
    confidence: high

  - type: update
    section: services
    itemId: customer-service
    field: endpoints
    reason: Nouvel endpoint DELETE /api/customers/{id} détecté.
    confidence: high

  - type: remove
    section: componentsToReplace
    itemId: legacy-rule-engine
    reason: Composant déjà supprimé de la codebase.
    confidence: medium
```

### 5.3 Livrables de cette phase

- `opays.manifest.proposed.yaml`
- Rapport d'analyse des écarts
- Recommandations de migration

---

## 6. Phase 5 — Validation humaine obligatoire

Aucune mise à jour du Manifest officiel n'a lieu sans validation explicite.

### 6.1 Critères de validation

- Les capabilities proposées sont-elles réellement actionnables par langage naturel ?
- Les rôles requis sont-ils corrects ?
- Les adaptateurs identifiés existent-ils ou sont-ils réalisables ?
- Les feature flags reflètent-ils la stratégie de migration ?
- Les changements sont-ils compatibles avec la version d'OIP cible ?

### 6.2 Application des changements

L'équipe applique manuellement les changements validés dans `opays.manifest.yaml`, puis commite avec un message explicite :

```text
chore(manifest): mise à jour capabilities suite ajout export de rapports
```

---

## 7. Phase 6 — Production du Migration Backlog

Une fois le Manifest v1 approuvé, le Discovery ne génère pas directement le Migration Backlog. Il fournit les informations nécessaires pour que l'équipe produise le Backlog.

Le **Migration Backlog** est construit exclusivement à partir du Manifest v1. Il décrit le travail de migration, tandis que le Manifest décrit l'application.

Le **Migration State** de l'application doit être mis à jour dans `migration.currentState` du Manifest à chaque étape validée. Voir `docs/oip-migration-state.md`.

### 7.1 Règles

- Le Manifest décrit l'application.
- Le Migration Backlog décrit le travail.
- Le Migration Blueprint décrit la stratégie d'exécution.
- Aucun Blueprint ne peut être produit sans un Backlog validé.

### 7.2 Contenu fourni par le Discovery

- modules, services et capabilities identifiés ;
- composants legacy à remplacer ;
- adaptateurs nécessaires ;
- dépendances critiques ;
- risques et dette technique.

## 8. Phase 7 — Utilisation par OIP

Une fois le Manifest validé, OIP l'utilise comme unique source de vérité pour :

- valider la compatibilité de version ;
- charger les capabilities ;
- identifier les adaptateurs requis ;
- connaître les feature flags de migration ;
- produire le Migration Backlog et le Blueprint.

L'état courant de l'intégration est consultable dans `docs/oip-pilot-applications.md`.

---

## 9. Anti-patterns interdits

| Interdit | Raison |
|---|---|
| Réécrire `opays.manifest.yaml` automatiquement | Le Manifest appartient à l'application et doit être validé humainement. |
| Générer un Blueprint sans Migration Backlog validé | Le Backlog est obligatoire avant toute stratégie d'exécution. |
| Générer du code OIP spécifique à l'application | OIP reste générique. Seuls les adaptateurs sont du ressort de l'application. |
| Analyser sans valider la compatibilité OIP | Un Manifest incompatible peut provoquer un échec de démarrage. |
| Ignorer les personnalisations manuelles | L'analyse doit protéger les décisions humaines. |
| Recommencer une étape déjà validée sans justification | Le Migration State reflète l'état réel ; il ne doit pas être régressé sans ADR. |

---

## 10. Checklist d'analyse

- [ ] Architecture de l'application comprise.
- [ ] Modules métier identifiés.
- [ ] Services et endpoints pertinents listés.
- [ ] Points d'entrée IA existants recensés.
- [ ] Composants legacy à remplacer identifiés.
- [ ] Capabilities candidates définies.
- [ ] Rôles et niveaux de confirmation proposés.
- [ ] Adaptateurs nécessaires identifiés.
- [ ] Dépendances critiques listées.
- [ ] Feature flags de migration proposés.
- [ ] Manifest généré dans une branche dédiée.
- [ ] Diff proposé et validé si Manifest existant.
- [ ] JSON Schema validé sur le Manifest final.
- [ ] Migration Backlog validé avant production du Blueprint.
- [ ] Migration State mis à jour dans le Manifest.

---

## 11. Références

- `docs/oip-integration-manifest-spec.md`
- `docs/opays.manifest.schema.json`
- `docs/adr/adr-005-integration-manifest.md`
- `docs/oip-manifest-validation-strategy.md`
- `docs/oip-migration-backlog-standard.md`
- `docs/oip-migration-state.md`
- `docs/oip-pilot-applications.md`
- `examples/opays.manifest.example.yaml`
- `examples/opays.migration-backlog.example.yaml`
