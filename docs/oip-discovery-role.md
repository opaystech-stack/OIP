# Rôle précis du Discovery

Le **Discovery** est le pilier OIP chargé de **comprendre une application existante** et de produire un Manifest proposé.

---

## 1. Mission

Analyser une codebase en lecture seule et générer un `opays.manifest.proposed.yaml` cohérent.

---

## 2. Entrées

- Chemin vers le dépôt d'une application.
- Options d'analyse (langage, profondeur, exclusions).

## 3. Sorties

- `opays.manifest.proposed.yaml`.
- Rapport d'analyse structuré.
- Diff avec un Manifest existant (le cas échéant).

---

## 4. Ce que le Discovery identifie

### 4.1 Architecture

- Langage et framework.
- Structure des dossiers.
- Patterns architecturaux (MVC, hexagonal, microservices, etc.).

### 4.2 Modules métier

- Dossiers ou packages correspondant à des domaines fonctionnels.
- Entités métier détectées.

### 4.3 Services et routes

- Endpoints HTTP.
- Services métiers.
- GraphQL resolvers, gRPC services, etc.

### 4.4 Composants IA

- Chatbots existants.
- Routeurs d'intentions.
- Moteurs de décision.
- Formulaires intelligents.

### 4.5 Capabilities candidates

- Actions déclenchées par du langage naturel.
- Verbes métier associés à des endpoints ou services.

### 4.6 Adaptateurs nécessaires

- Persistance.
- Authentification.
- Bus d'événements.
- Logs d'audit.

### 4.7 Risques et dette technique

- Code non testé.
- Dépendances obsolètes.
- Couplage fort.
- Logique conversationnelle dispersée.

---

## 5. Ce que le Discovery NE fait pas

- Il ne modifie jamais le code analysé.
- Il ne remplace jamais un Manifest validé existant.
- Il ne génère pas de code applicatif.
- Il ne dépend pas du Runtime.

---

## 6. Processus d'analyse

```text
Lecture du dépôt
  ↓
Extraction de la structure
  ↓
Identification des modules, services, routes
  ↓
Détection des composants IA
  ↓
Proposition de capabilities et d'adaptateurs
  ↓
Génération du Manifest proposé
  ↓
Rapport d'analyse
```

---

## 7. Protection des personnalisations manuelles

Si un Manifest existe déjà, le Discovery :

- charge le Manifest existant ;
- construit un Manifest théorique depuis la codebase ;
- compare les deux ;
- produit un `opays.manifest.proposed.yaml` avec un bloc `proposedChanges` ;
- signale les sections manuelles à ne pas écraser.

---

## 8. Références

- `docs/adr/adr-008-discovery.md`
- `docs/oip-discovery-to-manifest.md`
- `docs/oip-manifest-analysis-guide.md`
- `docs/opays.manifest.schema.json`
