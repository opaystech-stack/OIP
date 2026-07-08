# Opays Intelligence Platform — Glossaire et principes d'évolution

> Version: 1.0.0  
> Statut: Conceptuel  
> Date: Juillet 2026

---

## Glossaire

### OIP — Opays Intelligence Platform

Système d'exploitation pour les logiciels de l'entreprise Opays. Fournit intelligence conversationnelle, exécution, gouvernance, mémoire et connaissance aux produits métier.

### Workspace

Environnement métier complet appartenant à une organisation. Regroupe plugins, policies, connaissances, mémoires, identités, workflows et configurations.

### Runtime

Sous-système autonome d'OIP avec une responsabilité unique et un contrat public. Exemples : Decision Runtime, Action Runtime, Memory Runtime.

### Adapter

Implémentation concrète d'une interface technique. Exemples : `ZVecVectorAdapter`, `LangGraphWorkflowAdapter`, `OpenRouterLlmAdapter`.

### Plugin

Extension métier qui déclare ses capabilities, tools, workflows, sources de connaissance et skills à OIP. Chaque produit Opays (Commerce, RH, etc.) est un plugin.

### Capability

Unité d'action métier déclarée par un plugin. Exemple : `commerce.inventory.add`. Le moteur orchestre, le plugin exécute.

### ToolHandler

Fonction ou classe qui implémente une capability côté plugin. C'est la seule partie du plugin qui exécute réellement.

### Intention

Structure sémantique produite par le LLM Runtime à partir du langage naturel. Contient goal, entités, confiance et texte brut.

### ExecutionPlan

Plan d'exécution produit par le Decision Runtime. Contient des étapes (action, workflow, skill) avec leurs arguments et dépendances.

### Skill

Compétence réutilisable, indépendante du LLM. Catégories : core, product, enterprise, user, ui.

### Policy

Règle de gouvernance évaluée par Policy Runtime. Peut être RBAC, ABAC, conformité, règle métier ou consentement.

### DomainEvent

Événement métier produit par l'exécution d'une action. Exemples : `InventoryUpdated`, `EmployeeCreated`, `InvoicePaid`.

### Knowledge Source

Source de connaissance indexée par Knowledge Runtime. Peut être documentaire, SQL, API, web, email, GitHub.

### Memory Entry

Enregistrement de mémoire dans Memory Runtime. Types : conversation, user, organization, episodic.

---

## Principes d'évolution sur dix ans

### 1. Contrats publics stables

Les interfaces entre Runtimes sont les actifs les plus précieux. Elles changent rarement et toujours par versionnage.

### 2. Remplaçabilité totale des briques externes

LLM, base de données, orchestrateur, parser, observabilité doivent tous être remplaçables via Adapter.

### 3. Séparation intelligence / exécution

OIP raisonne et orchestre. Les plugins exécutent. Cette frontière ne doit jamais être franchie.

### 4. Multi-tenant par Workspace

Toute donnée, configuration et mémoire est scopée par Workspace. Jamais de fuite entre tenants.

### 5. Event-First

Toute action génère un événement. Audit, notifications, analytics et synchronisations en découlent.

### 6. Gouvernance programmable

Les règles de sécurité et de conformité sont déclaratives et modifiables sans redéploiement.

### 7. Évaluation continue

Decision Runtime, LLM Runtime, Workflow Runtime et Action Runtime doivent être mesurés, tracés et évalués.

### 8. Ouverture par protocoles standards

MCP, HTTP, OpenAI-compatible, OpenTelemetry. Pas de protocole propriétaire.

### 9. Local-first

OIP fonctionne aussi bien en local (Ollama, SQLite) qu'en cloud. Même codebase.

### 10. Évolution par adjonction

On ajoute des Runtimes, des Adapters, des Plugins et des Skills. On ne réécrit pas le core.

---

## Anti-patterns interdits

1. **Le LLM choisit une capability directement.** → Utiliser Intention + Decision Runtime.
2. **Un workflow appelle directement un plugin.** → Passer par Action Runtime.
3. **Le core importe une technologie externe.** → Utiliser un Adapter.
4. **La logique métier vit dans OIP.** → Déplacer dans un plugin.
5. **La gouvernance est dupliquée dans les plugins.** → Centraliser dans Policy Runtime.
6. **La mémoire est fragmentée par canal.** → Centraliser dans Memory Runtime.
7. **Knowledge Runtime modifie les sources.** → Lecture seule.
8. **Page Agent exécute des actions métier.** → UI Skill uniquement.
9. **Réécriture massive du core.** → Adjondre et remplacer par Adapter.
10. **Ignorer le versionnage des contrats.** → Tout contrat public est versionné.

---

> Document conceptuel. Aucune modification du code source n'a été effectuée.
