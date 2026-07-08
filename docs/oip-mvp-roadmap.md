# OIP - Roadmap MVP

## Strategie

Ne pas commencer par le moteur complet.

Construire un MVP d'OIP et le brancher rapidement sur Opays Commerce. Commerce devient le laboratoire permettant de valider les abstractions dans un produit reel.

## Phase 0 - Cadrage Technique

Objectif: verrouiller les contrats entre modules.

Livrables:

- schema Capability
- schema Tool
- schema Workflow
- schema Plugin
- contrats Context Builder
- contrats Planner
- contrats Validator
- contrats Action Engine
- format d'audit log

## Phase 1 - Core Minimal

Objectif: transformer une demande naturelle en action metier validee.

Modules:

- LLM Adapter minimal
- Context Builder minimal
- Planner minimal
- Validator minimal
- Capability Registry
- Tool Registry
- Action Engine
- Event Bus minimal

Scenario cible:

```text
Utilisateur: Ajoute 20 sacs de ciment au stock
Planner: inventory.add
Validator: verifie permissions et champs requis
Action Engine: appelle InventoryService.add()
Event Bus: publie InventoryUpdated
Reponse: confirme l'action
```

## Phase 2 - Plugin Commerce

Objectif: prouver que le moteur peut piloter un vrai domaine.

Capabilities initiales:

- inventory.add
- inventory.adjust
- customer.create
- sales.create
- invoice.create
- payment.record
- report.salesSummary

Workflows initiaux:

- creer une vente
- enregistrer un paiement
- generer un rapport journalier

## Phase 3 - Knowledge Engine Minimal

Objectif: connecter documents et donnees metier a l'assistant.

Livrables:

- Knowledge Source interface
- Document ingestion minimal
- chunking
- embeddings adapter
- vector adapter
- recherche hybride

Sources initiales:

- base Commerce
- documents PDF/Word
- historique conversations

## Phase 4 - Observabilite et Evaluation

Objectif: rendre le moteur debuggable des le debut.

Livrables:

- traces Langfuse
- logs d'execution
- cout par demande
- latence par module
- erreurs par capability
- audit log metier

## Phase 5 - Web Chat et Studio Minimal

Objectif: tester et administrer le moteur.

Livrables:

- widget chat web
- console de test capabilities
- visualisation des executions
- gestion basique des providers LLM
- gestion basique des plugins

## Definition de Reussite du MVP

Le MVP est valide lorsque:

- une capability Commerce peut etre declaree hors du coeur OIP
- le Planner peut choisir cette capability
- le Validator peut bloquer ou demander confirmation
- l'Action Engine execute via un service metier
- un workflow Commerce peut orchestrer plusieurs etapes
- l'action est auditee
- l'utilisateur recoit une explication claire
- le systeme peut changer de provider LLM sans modifier le coeur

