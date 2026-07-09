# Étude comparative : architecture de l'API publique des Runtime OIP

Version : `1.0.0-draft`  
Statut : Document d'étude  
Date : 2026-07-09

---

## 1. Objectif

Déterminer comment OIP doit exposer publiquement ses Runtimes afin que des applications externes (Opays-HQ, Forex, SDK, CLI, automations, MCP) puissent les consommer de manière stable, versionnée et indépendante des implémentations internes.

---

## 2. Contexte

OIP dispose aujourd'hui de plusieurs Runtimes métier :

- `IdentityRuntime`
- `PolicyRuntime`
- `MemoryRuntime`
- `EventRuntime`
- `ContextRuntime`
- `DecisionRuntime`
- `LlmRuntime`
- `KnowledgeRuntime`
- `ActionRuntime`

Ces Runtimes sont définis comme des **contrats** dans `packages/core/src/contracts/`, mais ils ne sont pas accessibles via le package unique `@opaystech/oip`.

L'unique point d'entrée public est `OipRuntime`, une classe monolithique qui mélange registres, moteurs et adaptateurs internes.

MB-001 a révélé que le point d'entrée `/chat` de l'exemple d'API HTTP n'est pas utilisable pour le Shadow Mode LLM car il combine planification + exécution. Opays-HQ a besoin d'un accès direct au LLM Runtime, via une API publique officielle.

---

## 3. Options étudiées

### Option A — Une API HTTP par Runtime

Chaque Runtime expose ses propres endpoints HTTP, versionnés et isolés.

**Exemple :**

```text
POST /v1/llm/generate-text
POST /v1/llm/embeddings
POST /v1/memory/append
POST /v1/memory/recall
POST /v1/events/publish
POST /v1/events/subscribe
POST /v1/identity/authenticate
POST /v1/policy/evaluate
POST /v1/context/build
POST /v1/decision/decide
POST /v1/actions/execute
```

#### Avantages
- Granularité maximale.
- Chaque Runtime peut évoluer indépendamment.
- Facile à scaler par domaine.
- Authentification/permissions par service.

#### Inconvénients
- Surface d'API très large.
- Difficile à versionner globalement.
- Risque de duplication de contrats (contexte, authentification, erreurs).
- Lourd pour les SDK et CLI.
- Nécessite une gateway ou un client par Runtime.

#### Sécurité
Bon : isolation par domaine, permissions fines.  
Mauvais : multiplie les surfaces d'attaque.

#### Évolutivité
Bon pour les gros volumes par domaine.  
Mauvais pour la cohérence globale.

---

### Option B — Une façade publique unique

Un seul point d'entrée public (`OipPublicApi` ou `POST /v1/oip/invoke`) route les appels vers les bons Runtimes.

**Exemple :**

```text
POST /v1/oip/invoke
{
  "service": "llm",
  "operation": "generateText",
  "requestId": "...",
  "payload": { ... }
}
```

#### Avantages
- Surface minimale.
- Versionnement centralisé.
- Facile à documenter.
- SDK trivial à générer.
- Cohérence authentification/erreurs/timeouts.

#### Inconvénients
- Couplage logique au routeur central.
- Moins naturel pour les API REST classiques.
- Peut masquer les spécificités de chaque Runtime.
- Point central de contention si mal conçu.

#### Sécurité
Bon : un seul point d'authentification.  
Mauvais : un bug dans le routeur affecte tous les services.

#### Évolutivité
Bon pour la maintenance.  
Nécessite une conception très stable du contrat d'invocation.

---

### Option C — Facade publique stable + API HTTP par Runtime en option

**Recommandation explorée.**

Une **facade publique stable** (`OipPublicRuntimeApi`) définit les contrats communs : requête, réponse, authentification, erreurs, versionnement, timeouts.

Cette facade expose des **opérations nommées** (`generateText`, `recallMemory`, `evaluatePolicy`, etc.) qui sont implémentées par un **routeur interne** appelant les Runtimes existants.

Par-dessus cette facade, deux formes d'exposition sont possibles :

1. **SDK public** : `import { OipPublicClient } from "@opaystech/oip"`.
2. **API HTTP unique** : `POST /v1/oip/invoke` mappant les opérations.
3. **API HTTP par Runtime en option** : si un déploiement préfère des endpoints séparés, une couche de mapping peut les générer à partir de la facade.

Cette option combine la stabilité d'un contrat unique avec la flexibilité d'une exposition multi-canal.

#### Avantages
- Contrat public unique, stable, versionné.
- Les Runtimes restent indépendants en interne.
- Permet SDK, CLI, HTTP, MCP, Automation avec le même contrat.
- Facile à étendre : ajouter une opération = ajouter une ligne dans la facade.
- Les évolutions internes ne cassent pas les consommateurs.

#### Inconvénients
- Nécessite une conception rigoureuse du contrat d'invocation.
- Le routeur central doit rester fin et ne pas devenir un nouvel empilement.
- Peut sembler moins « REST pur » que l'option A.

#### Sécurité
Excellente : authentification unique, permissions déclaratives par opération, audit centralisé.

#### Évolutivité
Excellente : le contrat évolue par version ; les implémentations peuvent changer.

#### Versionnement
Excellente : un numéro de version global (`v1`) couvre toutes les opérations.

#### Maintenance
Excellente : une seule surface à maintenir, documenter et tester.

#### Performances
Correcte : le routeur ajoute une indirection négligeable par rapport au coût des Runtimes (LLM, mémoire, etc.).

#### Facilité d'intégration
Excellente : un SDK généré à partir du contrat suffit pour la plupart des cas.

---

## 4. Comparaison synthétique

| Critère | A — API par Runtime | B — Facade unique | C — Facade stable + expositions multiples |
|---|---|---|---|
| Surface publique | Grande | Minimale | Minimale |
| Versionnement | Fragmenté | Centralisé | Centralisé |
| Stabilité | Faible | Forte | Forte |
| Sécurité | Bon mais dispersé | Bon | Excellent |
| Évolutivité | Par domaine | Globale | Globale + optionnelle |
| Maintenance | Lourde | Légère | Légère |
| SDK/CLI | Lourd | Léger | Léger |
| REST natif | Oui | Partiel | Optionnel |
| MCP/Automation | Mapping complexe | Mapping simple | Mapping simple |
| Adaptation à Opays-HQ | Oui mais verbeux | Oui | Oui et propre |
| Risque de refactor | Élevé | Faible | Faible |

---

## 5. Recommandation

**Option C : Facade publique stable + expositions multiples.**

### 5.1 Pourquoi C ?

1. **Stabilité contractuelle** : les consommateurs dépendent d'un contrat (`OipPublicRuntimeApi`), pas d'un Runtime concret. Cela permet de remplacer `InMemoryMemoryRuntime` par un `PostgresMemoryRuntime` sans casser les clients.
2. **Généricité** : la facade n'est pas liée à Opays-HQ. Les mêmes opérations serviront Forex, les futures applications, les plugins, le CLI, les SDK et les intégrations externes.
3. **Minimalisme** : la surface publique reste réduite. On n'expose pas chaque Runtime sous forme d'endpoint HTTP indépendant.
4. **Versionnement simple** : `v1` couvre toutes les opérations. Une opération obsolète est marquée `deprecated` ; une nouvelle opération peut être ajoutée sans casser `v1`.
5. **Transport agnostique** : le contrat peut être implémenté en HTTP, en mémoire (SDK), via gRPC, ou via MCP sans changer les consommateurs.
6. **Préparation au Shadow Mode** : Opays-HQ peut appeler `llm.generateText` en parallèle de son moteur legacy pour comparer les résultats, sans toucher à `/chat`.

### 5.2 Pourquoi pas A ?

Trop de surface publique, trop de points de versionnement, trop de duplication de contrats communs. Cette option tend à exposer les détails d'implémentation plutôt que les opérations métier.

### 5.3 Pourquoi pas B seul ?

L'option B est un cas particulier de C sans les expositions optionnelles. C est préférable car elle préserve la capacité à générer des endpoints REST par Runtime si un déploiement l'exige, sans pour autant en faire le contrat public par défaut.

---

## 6. Principe directeur

> L'API publique d'OIP expose des **opérations** stables, pas des **Runtimes**.

Les Runtimes restent des abstractions internes. Le contrat public est la facade. Les transports (HTTP, SDK, MCP, CLI) sont des implémentations secondaires de cette facade.

---

## 7. Références

- `docs/oip-runtime-api-audit.md`
- `docs/oip-public-contracts.md`
- `packages/core/src/contracts/index.ts`
- `packages/runtime/src/index.ts`
- MB-001 — Pre-Flight API Validation
