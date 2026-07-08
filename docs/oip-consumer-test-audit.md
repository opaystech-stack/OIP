# Audit — Consumer Test Project OIP

Ce document synthetise l’experience reelle d’un developpeur externe integrant OIP, telle que validee par le `consumer-test/`.

## Objectif du test

Verifier qu’un developpeur puisse :

1. Installer OIP simplement.
2. Initialiser le Runtime.
3. Enregistrer un plugin.
4. Declarer des Capabilities.
5. Executer une requete simple.
6. Le tout **sans importer de composant interne**.

## Resultat global

> **Statut** : ✅ Le Consumer Test compile et s’execute avec succes.

Les seuls imports utilises sont les chemins publics documentes :

- `@opaystech/oip`
- `@opaystech/oip/core`
- `@opaystech/oip/plugin-sdk`
- `@opaystech/oip/llm-adapter`

Aucun import interne (`packages/*/src/...`) n’a ete necessaire.

## Frictions identifiees et corrections apportees

### 1. Implementation d’un Tool trop verbeuse et typee trop strictement

**Probleme** : l’interface `ToolHandler` force le developpeur a ecrire une classe et a caster `status: "completed" as const`. Quand on place plusieurs tools concrets dans une `Map<string, ToolHandler>`, TypeScript rejette les types non invariants.

**Impact DX** : friction importante, surtout pour les developpeurs non experts TypeScript.

**Correction** : ajout de `defineTool` et des helpers `success` / `rejected` dans `@opaystech/oip/core`.

```ts
const addStockTool = defineTool(async (args, _context) => {
  return success("commerce.inventory.add", { ... }, [event]);
});
```

### 2. Definition d’un plugin trop manuelle

**Probleme** : la structure `OipPlugin` oblige a ecrire un objet avec `id`, `name`, `capabilities`, `tools`, sans helper.

**Correction** : ajout de `definePlugin` dans `@opaystech/oip/plugin-sdk`.

```ts
const plugin = definePlugin({ id: "commerce", name: "...", capabilities: [...], tools: map });
```

### 3. Necessite de builder OIP avant de consommer via `file:..`

**Probleme** : avec `file:..`, npm lie le repertoire source, mais les sous-chemins d’export (`@opaystech/oip/core`) pointent vers `dist/`. Le package doit donc etre buildé localement avant installation du consommateur.

**Impact DX** : etape supplementaire lors du developpement local, acceptable pour un package non publie.

**Mitigation** : documenter dans le SDK que `npm run build` est necessaire en mode `file:..`. Une fois publie sur GitHub Packages, cette friction disparaitra.

### 4. Pas d’import unique “tout-en-un”

**Observation** : le developpeur doit savoir quel sous-chemin utiliser (`core`, `plugin-sdk`, `llm-adapter`). C’est coherent avec une architecture modulaire, mais necessite une documentation claire.

**Recommandation** : conserver les sous-chemins, mais fournir un tableau recapitulatif dans le README et le SDK.

### 5. `OipRuntimeBuilder` / `ComposedRuntime` non exposes comme publics

**Observation** : ces facades avancees ne sont pas exportees par les chemins publics. C’est un choix volontaire pour l’instant.

**Recommandation** : stabiliser et exposer ces facades uniquement apres avoir valide leur usage reel par un consommateur.

## Points positifs

- Installation via `file:..` fonctionne des que `dist/` est present.
- Les sous-chemins d’export sont correctement resolus par TypeScript en `NodeNext`.
- L’API facade `OipRuntime` couvre 90% des besoins d’un consommateur simple.
- `defineCapability` est naturel et auto-documente.
- Le principe “capability + tool” reste comprehensible.

## API publique apres ajustements

| Chemin | Symboles cles |
|---|---|
| `@opaystech/oip` | `OipRuntime`, `createRuntimeFromEnv` |
| `@opaystech/oip/core` | `defineCapability`, `defineTool`, `definePlugin` (re-exporte via plugin-sdk), `success`, `rejected`, `ActionEngine`, `CapabilityRegistry`, `ToolRegistry`, `Validator`, `registerPlugin`, tous les types |
| `@opaystech/oip/plugin-sdk` | `definePlugin`, `definePluginModule`, `installPluginModule` |
| `@opaystech/oip/config` | `loadLlmConfig`, `createLlmAdapter` |
| `@opaystech/oip/llm-adapter` | `MockLlmAdapter`, `OpenAiCompatibleLlmAdapter` |
| `@opaystech/oip/adapters` | Interfaces adaptateurs externes |

## Recommandations finales avant publication

1. **Publier le package sur GitHub Packages** pour eliminer la friction `file:..` + build local.
2. **Finaliser la licence** avant toute publication stable.
3. **Ajouter un workflow GitHub Actions** qui publie automatiquement sur tag `v*`.
4. **Conserver `defineTool`, `success`, `rejected`, `definePlugin` dans l’API publique** : ils ameliorent significativement la DX.
5. **Ne pas exposer `OipRuntimeBuilder` / `ComposedRuntime`** tant qu’ils ne sont pas stabilises.
6. **Maintenir le Consumer Test Project** a jour a chaque evolution de l’API publique.
7. **Ajouter un test de non-regression** dans la CI d’OIP qui execute le Consumer Test pour detecter tout import interne accidentel.
8. **Produire un template de plugin** (`oip init` ou repo `oip-plugin-template`) pour reduire encore la friction.

## Conclusion

L’API publique d’OIP est maintenant **suffisante pour un consommateur externe simple**. Le Consumer Test prouve que l’integration est possible sans connaissance de l’implementation interne. Les helpers `defineTool`, `success` et `definePlugin` ont supprime les principales frictions.  

La prochaine etape logique est la **publication beta sur GitHub Packages** accompagnee d’un template de plugin.
