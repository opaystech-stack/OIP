# Opays Intelligence Platform — Architecture Decision Records v2

> Version: 2.0.0  
> Statut: En cours de validation  
> Date: Juillet 2026

---

## ADR-001 — OIP est un système d'exploitation pour logiciels d'entreprise

### Contexte

Le projet est actuellement présenté comme un moteur conversationnel centralisé. L'ambition réelle est devenir l'infrastructure commune de tous les futurs logiciels Opays.

### Décision

Opays Intelligence Platform (OIP) est un **système d'exploitation pour logiciels d'entreprise**. Il fournit exécution, gouvernance, mémoire, connaissance et orchestration conversationnelle. Les produits Opays ne sont plus des applications autonomes, mais des plugins qui déclarent leurs capacités à OIP.

### Conséquences

- L'intelligence réside dans OIP, pas dans les produits.
- Les produits se concentrent sur leur métier propre.
- OIP doit être conçu pour la multi-location, la scalabilité et la gouvernance.
- La valeur stratégique d'Opays déplace des applications vers la plateforme.

### Alternatives rejetées

- **Moteur conversationnel amélioré** : trop limité, ne valorise pas les produits existants.
- **Suite d'applications indépendantes avec un assistant commun** : crée de la duplication et empêche la réutilisation.

---

## ADR-002 — Architecture par Runtimes autonomes

### Contexte

Un système d'exploitation est composé de sous-systèmes spécialisés. OIP doit suivre le même principe.

### Décision

OIP est composé de **Runtimes autonomes** : Channel, Identity, Context, LLM, Decision, Policy, Workflow, Action, Memory, Knowledge, Event, Skill, Observability, Automation, MCP. Chaque Runtime a une responsabilité unique et un contrat public.

### Conséquences

- Isolation des responsabilités.
- Possibilité de remplacer, scaler ou auditer chaque Runtime indépendamment.
- Complexité accrue de l'assemblage, justifiant un Runtime Builder.

### Alternatives rejetées

- **Monolithe intelligent** : impossible à faire évoluer ou remplacer.
- **Microservices par module** : trop de distribution pour la phase actuelle.

---

## ADR-003 — Toute technologie externe est remplaçable par un Adapter

### Contexte

OIP dépendra de nombreuses briques externes : LLM, vector store, OCR, workflow engine, observabilité.

### Décision

Toute technologie externe est consommée via un **Adapter**. Le core et les Runtimes ne connaissent que l'interface de l'Adapter. L'implémentation concrète est interchangeable.

### Conséquences

- Aucune dépendance directe à ZVec, LangGraph, Docling, PaddleOCR, OpenRouter, Langfuse, etc. dans le core.
- Chaque Adapter peut être testé indépendamment.
- Le coût de migration technologique est concentré sur l'Adapter.

### Alternatives rejetées

- **Dépendances directes** : viole la pérennité et la modularité.
- **Forks ou wrappers internes** : maintenance lourde et inutile.

---

## ADR-004 — Le LLM n'exprime que des intentions

### Contexte

Dans l'implémentation actuelle, le planner LLM choisit directement une capability. Cela mélange compréhension et décision.

### Décision

Le **LLM Runtime** transforme le langage naturel en une **Intention** structurée (goal, entités, confiance). Il ne choisit jamais directement de capability, d'outil ou d'action. La traduction d'intention en plan d'exécution relève du **Decision Runtime**.

### Conséquences

- Le LLM devient un capteur sémantique, pas un agent décideur.
- Le Decision Runtime est testable, versionnable et gouvernable indépendamment du LLM.
- Réduction du risque d'actions mal choisies par le modèle.
- Nécessite un contrat `Intention` et un `Decision Runtime` puissant.

### Alternatives rejetées

- **LLM choisit la capability** : fragile, non déterministe, difficile à auditer.
- **Rule-based only** : trop limité pour le langage naturel libre.

---

## ADR-005 — Decision Runtime centralise la planification

### Contexte

Plusieurs Runtimes pourraient avoir envie de décider quoi faire. Il faut un seul responsable.

### Décision

Le **Decision Runtime** est le seul composant autorisé à transformer une `Intention` en `ExecutionPlan`. Il gère la discovery, le scoring, la sélection, la planification multi-étapes et la clarification.

### Conséquences

- Centralisation de la logique de décision.
- Possibilité de remplacer le moteur de décision sans toucher aux canaux ou plugins.
- Facilité d'évaluation et d'amélioration continue.

### Alternatives rejetées

- **Decision dispersée dans chaque Runtime** : incohérence et duplication.
- **Decision faite par le LLM** : non déterministe et non gouvernable.

---

## ADR-006 — Workspace = unité de tenant métier

### Contexte

Le terme "Application" prête à confusion avec les interfaces utilisateur. OIP a besoin d'une notion d'environnement complet.

### Décision

Le **Workspace** est l'unité de tenant métier. Un Workspace regroupe : plugins activés, policies, sources de connaissance, mémoires, identités, workflows et configurations propres à une organisation.

### Conséquences

- Un produit Opays devient un plugin activé dans un Workspace.
- Un Workspace peut activer plusieurs produits.
- Le multi-tenant est modélisé nativement.
- Les données sont scopées par Workspace.

### Alternatives rejetées

- **Application comme unité** : trop liée à l'UI, pas assez expressive pour la multi-location.
- **Organization seule** : ne capture pas la configuration produit par tenant.

---

## ADR-007 — Event-First : toute action produit un événement

### Contexte

L'audit, les synchronisations UI, les notifications et les analytics ont toutes besoin d'un flux d'événements.

### Décision

Toute action métier exécutée par OIP génère un événement dans **Event Runtime**. Les consommateurs s'y abonnent. L'audit est un sous-produit de ce flux.

### Conséquences

- Découplage entre producteurs et consommateurs.
- Traçabilité native.
- Possibilité de replay et de projections.
- Nécessite un Event Runtime fiable en production.

### Alternatives rejetées

- **Audit log ad-hoc** : duplication avec les besoins de synchronisation.
- **Appels directs entre modules** : couplage fort.

---

## ADR-008 — Capability = unité d'action métier déclarée par plugin

### Contexte

Les actions métier doivent être découvrables, gouvernables et réutilisables sans que le moteur en connaisse la sémantique.

### Décision

Chaque action métier est déclarée comme une **Capability** par un plugin. OIP orchestre, le plugin exécute via son `ToolHandler`. Le moteur ne connaît jamais la logique métier interne.

### Conséquences

- Le core OIP reste libre de toute logique métier.
- Les capabilities sont découvrables, versionnables et gouvernables.
- Les plugins exposent un catalogue d'actions normalisé.

### Alternatives rejetées

- **Actions codées dans le moteur** : viole le principe fondamental.
- **API REST directe appelée par le LLM** : dangereux et non gouvernable.

---

## ADR-009 — Policy Runtime = gouvernance centralisée

### Contexte

RBAC, ABAC, conformité, consentement et règles métier doivent être cohérents sur tous les canaux.

### Décision

Toutes les règles de gouvernance sont centralisées dans **Policy Runtime**. Les plugins déclarent des policies, mais ne les évaluent pas.

### Conséquences

- Cohérence de la gouvernance sur tous les canaux.
- Séparation entre logique métier (plugin) et gouvernance (Policy Runtime).
- Possibilité d'externaliser les règles (OPA, YAML).

### Alternatives rejetées

- **Gouvernance dans chaque plugin** : duplication et incohérence.
- **Gouvernance dans le Decision Runtime** : mélange planification et autorisation.

---

## ADR-010 — Memory Runtime = mémoire unifiée

### Contexte

La mémoire est actuellement limitée à l'historique conversationnel. OIP a besoin d'une mémoire riche et typée.

### Décision

Toutes les formes de mémoire (conversationnelle, utilisateur, organisationnelle, épisodique) sont gérées par **Memory Runtime**.

### Conséquences

- Modèle unifié de mémorisation.
- Mémoire exploitable par Context Runtime et Decision Runtime.
- Possibilité de recherche sémantique dans la mémoire.

### Alternatives rejetées

- **Mémoire dispersée par canal** : fragmentation et perte de contexte.
- **Mémoire uniquement conversationnelle** : trop limité pour la personnalisation.

---

## ADR-011 — Workflow Runtime est une abstraction ; LangGraph n'est qu'une implémentation

### Contexte

LangGraph est proposé comme orchestrateur de workflows, mais OIP ne doit pas en dépendre conceptuellement.

### Décision

**Workflow Runtime** expose un contrat stable. LangGraph, Temporal, n8n ou un moteur maison peuvent être branchés derrière un `WorkflowAdapter`. Le choix de l'implémentation n'impacte pas les plugins ni le Decision Runtime.

### Conséquences

- Liberté technologique.
- Pas de lock-in sur LangGraph.
- Le contrat `WorkflowRuntime` est la seule dépendance autorisée.

### Alternatives rejetées

- **LangGraph directement dans le core** : lock-in conceptuel.
- **Workflows codés dans les prompts** : non maintenable.

---

## ADR-012 — Skills indépendants du LLM

### Contexte

La vision actuelle mentionne des Skills, mais aucune abstraction n'existe dans le code.

### Décision

Les **Skills** (core, product, enterprise, user, UI) sont des composants exécutables indépendants du modèle de langage. Ils sont gérés par **Skill Runtime**. Page Agent est un UI Skill, pas un exécutant métier.

### Conséquences

- Les skills peuvent fonctionner avec n'importe quel LLM ou sans LLM.
- Page Agent est cantonné à l'onboarding et à l'aide UI.
- Réutilisation des compétences entre produits.

### Alternatives rejetées

- **Skills intégrés au planner** : couplage au LLM.
- **Pas de couche skill** : la vision ne serait pas implémentée.

---

## ADR-013 — Identity Runtime externalise l'authentification

### Contexte

L'authentification est actuellement absente de l'API. OIP doit gérer des identités provenant de multiples sources.

### Décision

**Identity Runtime** est responsable de l'authentification, de la résolution de Workspace et de l'autorisation de base. Il peut s'appuyer sur des providers externes (SSO, OAuth, API keys).

### Conséquences

- Auth centralisée et testable.
- Support multi-tenant clair.
- Les canaux n'implémentent pas d'auth.

### Alternatives rejetées

- **Auth dans chaque channel** : duplication.
- **Pas d'auth dans le MVP** : bloque tout déploiement production.

---

## ADR-014 — Knowledge Runtime est en lecture seule par rapport aux sources métier

### Contexte

OIP indexera des bases SQL, des APIs et des documents. Il ne doit pas devenir un système transactionnel.

### Décision

**Knowledge Runtime** indexe, enrichit et recherche dans les sources de connaissance. Il ne modifie jamais les données métier sources. Toute modification métier passe par Action Runtime et un plugin.

### Conséquences

- Séparation claire entre connaissance et transaction.
- Pas de risque de corruption des données métier par le moteur.
- Les sources restent maîtresses.

### Alternatives rejetées

- **Knowledge Runtime écrit dans les bases sources** : violation du périmètre.

---

## ADR-015 — Observability Runtime centralise traces LLM et techniques

### Contexte

Les coûts LLM, la latence, les erreurs et les prompts doivent être traçables.

### Décision

**Observability Runtime** centralise les traces techniques (OpenTelemetry) et les traces LLM (Langfuse). Tout Runtime peut émettre des événements d'observabilité.

### Conséquences

- Debugging unifié.
- Benchmark du coût par requête.
- Évaluation continue des Runtimes critiques.

### Alternatives rejetées

- **Logs ad-hoc dans chaque Runtime** : inexplorable.
- **Pas de traces LLM** : impossible d'optimiser.

---

## ADR-016 — Local-first possible

### Contexte

Les marchés africains imposent parfois une exécution locale, hors ligne ou à faible latence.

### Décision

OIP doit pouvoir fonctionner en mode **local-first** : Ollama pour le LLM, SQLite pour la persistence, stockage fichiers pour documents. Le mode cloud reste une configuration, pas une obligation.

### Conséquences

- Adaptation aux contraintes locales.
- Même code base pour local et cloud.
- Nécessite des adapters légers.

### Alternatives rejetées

- **Cloud-only** : exclut des cas d'usage critiques.
- **Deux codebases** : maintenance impossible.

---

## ADR-017 — Évolution par adjonction et versionnage des contrats

### Contexte

OIP doit rester stable sur dix ans tout en évoluant.

### Décision

Les contrats publics entre Runtimes sont versionnés. Une nouvelle fonctionnalité s'ajoute par adjonction d'un Runtime, d'un Adapter, d'un Plugin ou d'un Skill. Aucune modification destructive d'un contrat existant n'est autorisée sans versionnage.

### Conséquences

- Pérennité des intégrations.
- Plugins existants continuent de fonctionner.
- Tests de compatibilité par version de contrat.

### Alternatives rejetées

- **Réécritures fréquentes** : dette et rupture.
- **Contrats implicites** : non maintenable.

---

## ADR-018 — Action Runtime est le seul exécutant de capabilities

### Contexte

Seul Action Runtime doit exécuter les actions métier pour garantir gouvernance et traçabilité.

### Décision

**Action Runtime** est le seul Runtime autorisé à invoquer un `ToolHandler` de plugin. Workflow Runtime et autres orchestrateurs passent par Action Runtime pour chaque étape.

### Conséquences

- Point de contrôle unique.
- Gouvernance uniforme.
- Audit complet.

### Alternatives rejetées

- **Workflow Runtime appelle directement les tools** : court-circuite Policy et Audit.
- **Plugins exécutés depuis n'importe où** : non traçable.

---

## Résumé des ADRs

| ID | Décision |
|----|----------|
| ADR-001 | OIP = système d'exploitation |
| ADR-002 | Architecture par Runtimes |
| ADR-003 | Tout externe via Adapter |
| ADR-004 | LLM = intention seulement |
| ADR-005 | Decision Runtime centralise la planification |
| ADR-006 | Workspace = tenant métier |
| ADR-007 | Event-First |
| ADR-008 | Capability = unité d'action plugin |
| ADR-009 | Policy Runtime = gouvernance |
| ADR-010 | Memory Runtime = mémoire unifiée |
| ADR-011 | Workflow Runtime abstraction |
| ADR-012 | Skills indépendants du LLM |
| ADR-013 | Identity Runtime externalise auth |
| ADR-014 | Knowledge Runtime en lecture seule |
| ADR-015 | Observability Runtime centralisé |
| ADR-016 | Local-first possible |
| ADR-017 | Évolution par adjonction |
| ADR-018 | Action Runtime = seul exécutant |

---

> Document conceptuel. Aucune modification du code source n'a été effectuée.
