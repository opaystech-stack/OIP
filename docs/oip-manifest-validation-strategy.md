# Stratégie de validation du Manifest dans OIP

Ce document définit comment OIP valide un `opays.manifest.yaml` et quelles erreurs sont attendues lorsqu'un Manifest est invalide ou incompatible.

---

## 1. Objectif

OIP doit refuser de démarrer avec un Manifest incorrect ou incompatible de manière claire et actionnable. La validation se déroule en trois niveaux successifs :

1. Validation de schéma.
2. Validation de compatibilité de version.
3. Validation sémantique.

---

## 2. Niveau 1 — Validation de schéma

### 2.1 Schéma de référence

`docs/opays.manifest.schema.json`

### 2.2 Outil recommandé

Tout validateur JSON Schema conforme Draft 2020-12, par exemple :

- `ajv` en JavaScript/TypeScript.
- `jsonschema` en Python.
- `check-jsonschema` en CLI.

### 2.3 Exemple de commande CLI

```bash
npx check-jsonschema --schemafile docs/opays.manifest.schema.json opays.manifest.yaml
```

### 2.4 Erreurs attendues

| Code | Cause | Exemple |
|---|---|---|
| `SCHEMA_REQUIRED_FIELD_MISSING` | Champ obligatoire absent | `manifestVersion` manquant |
| `SCHEMA_INVALID_TYPE` | Type incorrect | `application.id` est un nombre |
| `SCHEMA_INVALID_FORMAT` | Format invalide | `repository` n'est pas une URI |
| `SCHEMA_PATTERN_MISMATCH` | Regex non respectée | `capability.id` contient un tiret au lieu d'un point |
| `SCHEMA_ADDITIONAL_PROPERTY` | Champ non défini par le schéma | Section `customField` racine |

### 2.5 Comportement d'OIP

- Si la validation de schéma échoue, OIP refuse de démarrer.
- Toutes les erreurs de schéma sont listées dans les logs.

---

## 3. Niveau 2 — Validation de compatibilité de version

### 3.1 Règles

- `oipCompatibility.min` est obligatoire.
- `oipCompatibility.max` est optionnel.
- La version courante d'OIP doit être `>= min` et `<= max` (si max est défini).
- La comparaison utilise la sémantique SemVer.

### 3.2 Erreurs attendues

| Code | Cause |
|---|---|
| `COMPAT_VERSION_TOO_OLD` | OIP courant < `oipCompatibility.min` |
| `COMPAT_VERSION_TOO_RECENT` | OIP courant > `oipCompatibility.max` |
| `COMPAT_INVALID_RANGE` | `min` > `max` |
| `COMPAT_MISSING_MIN` | `oipCompatibility.min` absent |

### 3.3 Comportement d'OIP

- En cas d'incompatibilité, OIP refuse de démarrer.
- Le message indique la version OIP courante et la plage attendue.
- L'application doit mettre à jour son Manifest ou downgrader OIP.

---

## 4. Niveau 3 — Validation sémantique

### 4.1 Objectif

Vérifier que les références internes du Manifest sont cohérentes.

### 4.2 Règles

- Chaque `service.moduleId` doit correspondre à un `module.id` existant.
- Chaque `capability.moduleId` doit correspondre à un `module.id` existant.
- Chaque `capability.toolHandler` doit correspondre à un handler enregistré par un adaptateur.
- Chaque `featureFlag.dependsOn` doit correspondre à un `featureFlag.id` existant.
- Les cycles de dépendances entre feature flags sont interdits.
- Chaque `componentToReplace.migrationPhase` doit correspondre à une phase définie dans `migration.phases`.

### 4.3 Erreurs attendues

| Code | Cause |
|---|---|
| `SEM_MODULE_NOT_FOUND` | `moduleId` référencé mais non défini |
| `SEM_TOOL_HANDLER_UNKNOWN` | `toolHandler` non fourni par un adaptateur |
| `SEM_FEATURE_FLAG_CYCLE` | Cycle détecté dans `dependsOn` |
| `SEM_FEATURE_FLAG_UNKNOWN` | `dependsOn` référence un flag inexistant |
| `SEM_PHASE_MISMATCH` | `migrationPhase` référence une phase inconnue |
| `SEM_CAPABILITY_DUPLICATE` | Deux capabilities partagent le même `id` |

### 4.4 Comportement d'OIP

- Les erreurs sémantiques bloquent le démarrage.
- Les erreurs sont regroupées par catégorie pour faciliter la correction.

---

## 5. Cycle de validation recommandé

```text
Application fournit opays.manifest.yaml
              ↓
OIP lit le fichier
              ↓
Validation de schéma
              ↓
Validation de compatibilité OIP
              ↓
Validation sémantique
              ↓
Manifest accepté → OIP démarre
```

---

## 6. Messages d'erreur standardisés

OIP doit produire des messages d'erreur de la forme suivante :

```text
[MANIFEST-ERROR] {code}: {message}
  context: {chemin ou valeur concernée}
  suggestion: {action corrective}
```

Exemple :

```text
[MANIFEST-ERROR] SCHEMA_REQUIRED_FIELD_MISSING: manifestVersion is required
  context: root
  suggestion: Add a SemVer version at the root of the Manifest.
```

---

## 7. Intégration dans la CI

### 7.1 Validation automatique

Chaque application doit valider son Manifest dans sa propre CI :

```yaml
- name: Validate Opays Manifest
  run: npx check-jsonschema --schemafile https://raw.githubusercontent.com/opaystech-stack/OIP/main/docs/opays.manifest.schema.json opays.manifest.yaml
```

### 7.2 Validation dans OIP

OIP peut exposer une commande CLI à terme :

```bash
npx oip validate-manifest opays.manifest.yaml
```

Cette commande exécute les trois niveaux de validation et retourne un code de sortie non nul en cas d'erreur.

---

## 8. Évolution de la validation

- Toute évolution du schéma donne lieu à une nouvelle version du JSON Schema.
- Les versions d'OIP annoncent les versions de schéma qu'elles supportent.
- Une ADR est requise pour tout changement incompatible du schéma.

---

## 9. Références

- `docs/opays.manifest.schema.json`
- `docs/oip-integration-manifest-spec.md`
- `docs/oip-manifest-analysis-guide.md`
- `docs/adr/adr-005-integration-manifest.md`
