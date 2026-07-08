# Le Generator utilise le Manifest

Ce document décrit le processus par lequel le Generator transforme un Manifest validé en codebase.

---

## 1. Prérequis

- Un `opays.manifest.yaml` validé contre `docs/opays.manifest.schema.json`.
- La version OIP cible compatible avec `oipCompatibility`.

---

## 2. Étapes de génération

### Étape 1 : Chargement et validation du Manifest

Le Generator lit le Manifest et le valide :

- validation de schéma ;
- validation de compatibilité OIP ;
- validation sémantique minimale.

En cas d'erreur, la génération s'arrête immédiatement avec un message explicite.

### Étape 2 : Sélection du template

Le Generator choisit un template de projet en fonction de :

- `dependencies.runtime` (ex. Node.js, Python) ;
- présence d'un frontend ;
- options de génération.

### Étape 3 : Rendu des fichiers

Pour chaque section du Manifest, le Generator rend des fichiers :

| Section Manifest | Fichiers générés |
|---|---|
| `application` | `package.json`, `README.md`, `.env.example` |
| `modules` | Dossiers `src/modules/{id}/` |
| `services` | Contrôleurs/services stubés, adaptateurs |
| `api.routes` | Déclaration des routes |
| `aiEntrypoints` | Composants chat/voice de base |
| `componentsToReplace` | Notes de migration dans `docs/migration/` |
| `capabilities` | `src/plugins/oip/capabilities/` |
| `adapters` | `src/adapters/` |
| `dependencies` | Dépendances dans `package.json` |
| `featureFlags` | Configuration par défaut |
| `migration` | `docs/migration/blueprint.md` |

### Étape 4 : Application des conventions OIP

Le Generator applique :

- conventions de nommage ;
- structure des plugins OIP ;
- types des capabilities ;
- configuration de la CI/CD.

### Étape 5 : Copie du Manifest

Le Manifest original est copié à la racine du projet généré.

### Étape 6 : Sortie

Le Generator retourne le chemin du projet généré et la liste des fichiers.

---

## 3. Exemple de commande

```bash
npx oip generate --manifest opays.manifest.yaml --output ./generated/opays-hq
```

---

## 4. Règles de personnalisation

- Le code généré est une **base standard**.
- Les développeurs implémentent la logique métier dans les tool handlers.
- Les personnalisations ne modifient jamais le contrat du Manifest.

---

## 5. Références

- `docs/oip-generator-role.md`
- `docs/oip-integration-manifest-spec.md`
- `docs/opays.manifest.schema.json`
