# OIP - Vision et Architecture

## Ambition

Opays Intelligence Platform vise a devenir la premiere plateforme d'intelligence conversationnelle concue pour les entreprises africaines.

L'objectif n'est pas que chaque logiciel Opays possede son propre assistant. L'objectif est de centraliser l'intelligence dans une plateforme commune, reutilisable et extensible, pendant que chaque produit fournit uniquement ses capacites metier.

## Experience Cible

Un utilisateur doit pouvoir dire:

- Ajoute 20 sacs de ciment au stock.
- Prepare une facture pour Patrick.
- Qui me doit encore de l'argent ?
- Genere le rapport mensuel.

Le moteur doit comprendre, planifier, valider, executer et expliquer.

## Architecture Generale

```text
Interfaces
  Web / Mobile / WhatsApp / Telegram / API / Voix
        |
        v
Opays Intelligence Platform
        |
        v
Context Builder
        |
        v
Planner
        |
        v
Validator
        |
        v
Workflow Engine
        |
        v
Action Engine
        |
        v
Applications metier et services autorises
```

Les applications ne communiquent jamais directement avec le LLM.

## Modules Fondateurs

### LLM Adapter

Abstraction complete des fournisseurs IA:

- OpenAI
- Anthropic
- Gemini
- DeepSeek
- Kimi
- Qwen
- OpenRouter
- Ollama
- APIs compatibles OpenAI

Le reste du moteur ne doit jamais connaitre le fournisseur utilise.

### Context Builder

Construit le contexte utile avant l'appel au LLM:

- utilisateur connecte
- role
- organisation
- module actif
- page actuelle
- langue
- historique
- preferences
- memoire utilisateur
- contexte metier
- resultats Knowledge Engine

### Planner

Transforme une demande naturelle en plan structure.

Exemple:

```json
{
  "intent": "sales.create",
  "arguments": {
    "customer": "Patrick",
    "items": []
  }
}
```

Le Planner ne realise aucune action.

### Validator

Controle avant execution:

- RBAC
- validations metier
- confirmations
- coherence
- contraintes
- niveau de risque

Aucune action critique ne doit etre executee sans validation.

### Workflow Engine

Orchestre plusieurs capacites metier.

Exemple pour une vente:

```text
create sale
  -> decrement inventory
  -> create cash movement
  -> create accounting entries
  -> update analytics
  -> notify
```

Cette logique ne doit pas vivre dans le prompt IA.

### Action Engine

Seul composant autorise a appeler les services metier.

Le LLM choisit une capability. L'Action Engine execute via un outil autorise.

### Capability Registry

Chaque application declare ses capacites:

- sales.create
- inventory.add
- customer.create
- employee.create
- property.register
- case.create

Chaque capability decrit:

- description
- parametres
- permissions
- validations
- evenements
- effets secondaires
- niveau de confirmation

### Tool Registry

Lie une capability a un outil reel.

Exemple:

```text
sales.create -> SalesService.create()
```

### Workflow Registry

Declare les workflows disponibles pour les capabilities.

Les workflows restent proches des applications metier, mais OIP les orchestre.

### Knowledge Engine

Centralise plusieurs types de connaissance:

- Business Knowledge: SQLite, PostgreSQL, APIs metier
- Semantic Knowledge: embeddings, similarite, resolution d'entites
- Document Knowledge: PDF, Word, Excel, OCR, HTML, Markdown
- Conversation Knowledge: historique, resumes, memoire longue
- User Knowledge: preferences, alias, habitudes

### Skill Engine

Supporte plusieurs niveaux de skills:

- Core Skills
- Product Skills
- Enterprise Skills
- User Skills
- UI Skills

Page Agent reste un UI Skill pour guider l'utilisateur, jamais le moteur principal d'execution metier.

### Plugin SDK

Chaque nouveau produit Opays doit pouvoir s'installer sous forme de plugin:

```ts
engine.use(CommercePlugin);
engine.use(HRPlugin);
engine.use(RealEstatePlugin);
```

Un plugin expose:

- Capabilities
- Tools
- Workflows
- Documents
- Skills
- Permissions
- UI Components
- Knowledge Sources
- Connecteurs MCP

### Event Bus

Toutes les actions produisent des evenements:

- SaleCreated
- EmployeeCreated
- InvoicePaid
- StockUpdated

Ces evenements servent aux notifications, statistiques, synchronisations, rafraichissements UI et automatisations.

## Decision Strategique

Le MVP doit commencer avec Opays Commerce comme laboratoire. Cela permet de valider les concepts de capabilities, plugins, workflows, knowledge engine et skills dans un produit reel avant d'ouvrir la plateforme aux autres domaines.

