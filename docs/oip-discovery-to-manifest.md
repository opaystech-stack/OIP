# Le Discovery produit le Manifest

Ce document décrit le processus par lequel le Discovery analyse une codebase existante et produit un Manifest proposé.

---

## 1. Prérequis

- Accès en lecture seule au dépôt de l'application.
- Aucune modification autorisée.

---

## 2. Étapes de l'analyse

### Étape 1 : Exploration de la structure

Le Discovery lit :

- fichiers de configuration ;
- arborescence des dossiers ;
- dépendances.

### Étape 2 : Identification des modules métier

Le Discovery détecte :

- dossiers fonctionnels ;
- entités métier ;
- services ou repositories.

### Étape 3 : Extraction des services et routes

Le Discovery identifie :

- endpoints HTTP ;
- méthodes associées ;
- paramètres et réponses.

### Étape 4 : Détection des points d'entrée IA

Le Discovery repère :

- composants de chat ;
- commandes vocales ;
- formulaires intelligents ;
- assistants existants.

### Étape 5 : Identification des composants legacy

Le Discovery liste les composants à remplacer par OIP :

- parsers de langage naturel ;
- routeurs d'intentions ;
- moteurs de décision maison.

### Étape 6 : Proposition de capabilities

Pour chaque action métier conversationnelle détectée, le Discovery propose une capability avec :

- identifiant ;
- paramètres ;
- rôles requis ;
- niveau de confirmation ;
- événements émis.

### Étape 7 : Proposition d'adaptateurs

Le Discovery déduit les adaptateurs nécessaires à partir de :

- la persistance utilisée ;
- le système d'authentification ;
- le bus d'événements ;
- les sources de connaissance.

### Étape 8 : Rapport d'analyse

Le Discovery produit un rapport structuré avec :

- synthèse ;
- modules ;
- services ;
- capabilities candidates ;
- adaptateurs ;
- risques ;
- dette technique.

---

## 3. Manifest proposé

### Si aucun Manifest n'existe

Le Discovery génère un `opays.manifest.yaml` complet dans une branche dédiée.

### Si un Manifest existe

Le Discovery génère un `opays.manifest.proposed.yaml` contenant :

- le Manifest existant ;
- un bloc `proposedChanges` ;
- des justifications et niveaux de confiance.

---

## 4. Exemple de commande

```bash
npx oip discover --source ./apps/opays-hq --output ./proposals/opays-hq
```

---

## 5. Validation humaine obligatoire

Le Manifest proposé ne devient officiel qu'après validation humaine.

L'équipe charge le `opays.manifest.proposed.yaml`, corrige les erreurs, puis l'applique comme `opays.manifest.yaml` officiel.

---

## 6. Références

- `docs/oip-discovery-role.md`
- `docs/oip-manifest-analysis-guide.md`
- `docs/opays.manifest.schema.json`
- `docs/oip-public-contracts.md`
