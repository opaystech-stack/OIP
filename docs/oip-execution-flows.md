# Opays Intelligence Platform — Flux d'exécution

> Version: 1.0.0  
> Statut: Conceptuel  
> Date: Juillet 2026

Ce document formalise les flux d'exécution entre les Runtimes d'OIP. Chaque flux est décrit avec : déclencheur, Runtimes impliqués, contrats échangés, points de décision et sorties.

---

## 1. Flux principal : langage naturel → action métier

### Déclencheur

L'utilisateur envoie un message via un canal (web, mobile, WhatsApp, Telegram, API, voix).

### Séquence

```text
┌─────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│ Channel │───▶│ Identity │───▶│ Context  │───▶│   LLM    │
│ Runtime │    │ Runtime  │    │ Runtime  │    │ Runtime  │
└─────────┘    └──────────┘    └──────────┘    └──────────┘
                                                   │
                                                   ▼
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│ Channel  │◀───│  Skill   │◀───│  Action  │◀───│ Decision │
│ Runtime  │    │ Runtime  │    │ Runtime  │    │ Runtime  │
└──────────┘    └──────────┘    └──────────┘    └──────────┘
                                    │
                                    ▼
                              ┌──────────┐
                              │  Plugin  │
                              │  Métier  │
                              └──────────┘
                                    │
                                    ▼
                              ┌──────────┐
                              │  Event   │
                              │ Runtime  │
                              └──────────┘
```

### Étapes détaillées

| # | Runtime | Action | Contrat produit |
|---|---------|--------|-----------------|
| 1 | Channel Runtime | Reçoit le payload du canal | `InboundRequest` |
| 2 | Identity Runtime | Authentifie et résout le Workspace | `IdentityContext`, `Workspace` |
| 3 | Context Runtime | Enrichit avec mémoire et connaissances | `ExecutionContext` |
| 4 | LLM Runtime | Transforme le texte en `Intention` | `Intention` |
| 5 | Decision Runtime | Traduit l'intention en `ExecutionPlan` | `ExecutionPlan` ou `Clarification` |
| 6 | Policy Runtime | Valide le plan selon les règles | `PolicyDecision` |
| 7 | Action Runtime | Exécute la capability via le plugin | `ActionResult` |
| 8 | Event Runtime | Publie les événements métier | `DomainEvent` |
| 9 | Memory Runtime | Persiste l'interaction | `MemoryEntry` |
| 10 | Skill Runtime | Génère la réponse utilisateur | `OutboundResponse` |
| 11 | Channel Runtime | Retourne la réponse au canal | — |

### Points de décision

- Si `Intention.confidence` est trop faible → clarification.
- Si `ExecutionPlan.requiresConfirmation` est vrai → demander confirmation à l'utilisateur.
- Si `PolicyDecision.effect === "deny"` → rejeter avec explication.
- Si `ExecutionPlan` contient plusieurs étapes dépendantes → Workflow Runtime.

---

## 2. Flux de clarification

### Déclencheur

Le Decision Runtime ne parvient pas à sélectionner une capability unique ou manque d'informations.

### Séquence

```text
Decision Runtime ──> Skill Runtime (ClarificationSkill)
                            │
                            ▼
                    Skill Runtime (ResponseBuilderSkill)
                            │
                            ▼
                    Channel Runtime ──> Utilisateur
                            │
                            ▼
                    Channel Runtime ──> Identity Runtime
                            │
                            ▼
                    Context Runtime met à jour le contexte
                            │
                            ▼
                    Decision Runtime relance avec contexte enrichi
```

### Règle

La clarification est gérée comme une skill (`ClarificationSkill`), jamais comme un cas particulier du planner.

---

## 3. Flux workflow : exécution multi-étapes

### Déclencheur

Le Decision Runtime produit un `ExecutionPlan` avec plusieurs étapes dépendantes ou avec état.

### Séquence

```text
Decision Runtime ──> Policy Runtime (validation globale)
                            │
                            ▼
                    Workflow Runtime (démarrage)
                            │
                            ▼
                    Workflow Runtime ──> Action Runtime (étape 1)
                            │
                            ▼
                    Event Runtime (événement d'étape)
                            │
                            ▼
                    Workflow Runtime ──> Action Runtime (étape 2)
                            │
                            ▼
                    ...
                            │
                            ▼
                    Workflow Runtime ──> Event Runtime (completion)
                            │
                            ▼
                    Skill Runtime ──> Channel Runtime (réponse)
```

### Règle

Workflow Runtime ne jamais appelle directement un plugin. Chaque étape passe par Action Runtime.

---

## 4. Flux événementiel déclenché

### Déclencheur

Un plugin métier, un système externe ou un workflow publie un événement.

### Séquence

```text
Plugin / Système externe ──> Event Runtime
                                    │
                                    ▼
                            Event Runtime (route l'événement)
                                    │
                                    ▼
                            Decision Runtime (évalue si action requise)
                                    │
                                    ▼
                            Policy Runtime (valide)
                                    │
                                    ▼
                            Action / Workflow Runtime (exécute)
                                    │
                                    ▼
                            Event Runtime (publie résultat)
                                    │
                                    ▼
                            Channel Runtime (notifie si nécessaire)
```

### Exemples

- `InvoicePaid` → générer un reçu, notifier le client.
- `StockLow` → suggérer un réapprovisionnement au responsable.

---

## 5. Flux de connaissance

### Déclencheur

Le Context Runtime ou le Decision Runtime a besoin de connaissances contextuelles.

### Séquence

```text
Context Runtime ──> Knowledge Runtime (search)
                            │
                            ▼
                    Knowledge Runtime ──> Vector Adapter
                    Knowledge Runtime ──> Document Adapter
                    Knowledge Runtime ──> OCR Adapter
                    Knowledge Runtime ──> SQL Adapter
                            │
                            ▼
                    Knowledge Runtime fusionne et score
                            │
                            ▼
                    Context Runtime / Decision Runtime reçoit `KnowledgeResult[]`
```

### Règle

Knowledge Runtime ne modifie jamais les sources. Il indexe et recherche.

---

## 6. Flux de mémoire

### Déclencheur

Avant et après chaque interaction.

### Séquence

```text
Context Runtime ──> Memory Runtime (recall)
                            │
                            ▼
                    Memory Runtime ──> Store (SQLite/Postgres/Vector)
                            │
                            ▼
                    Context Runtime reçoit `MemoryResult[]`

Après exécution :

Action Runtime / Skill Runtime ──> Memory Runtime (append)
                                        │
                                        ▼
                                Memory Runtime persiste l'interaction
```

---

## 7. Flux d'observabilité

### Déclencheur

Tout appel de Runtime critique.

### Séquence

```text
Runtime X ──> Observability Runtime.trace(name, metadata, operation)
                        │
                        ▼
                Observability Runtime ──> Langfuse (traces LLM)
                Observability Runtime ──> OpenTelemetry (traces techniques)
                Observability Runtime ──> Audit store (événements métier)
                        │
                        ▼
                Retourne le résultat de l'opération
```

### Règle

L'observabilité est un aspect transverse. Aucun Runtime ne devrait implémenter son propre tracing.

---

## 8. Flux MCP / Automation

### Déclencheur

Le Decision Runtime ou un workflow a besoin d'un outil externe standardisé.

### Séquence

```text
Decision Runtime ──> MCP Runtime (callTool)
                            │
                            ▼
                    MCP Runtime ──> Serveur MCP externe
                            │
                            ▼
                    MCP Runtime retourne le résultat structuré

Ou :

Workflow Runtime ──> Automation Runtime (trigger)
                            │
                            ▼
                    Automation Runtime ──> n8n / Zapier
                            │
                            ▼
                    Automation Runtime confirme le déclenchement
```

---

## 9. Flux de confirmation utilisateur

### Déclencheur

Policy Runtime ou Decision Runtime détermine qu'une action sensible nécessite une confirmation explicite.

### Séquence

```text
Decision Runtime ──> Policy Runtime
                            │
                            ▼
                    PolicyDecision.effect === "confirm"
                            │
                            ▼
                    Skill Runtime (ResponseBuilderSkill) génère la demande
                            │
                            ▼
                    Channel Runtime ──> Utilisateur
                            │
                            ▼
                    Utilisateur confirme
                            │
                            ▼
                    Channel Runtime ──> Decision Runtime avec confirmation
                            │
                            ▼
                    Action Runtime exécute avec `confirmed: true`
```

### Règle

La confirmation est un état géré par le contexte d'exécution, pas un hack dans le prompt LLM.

---

## 10. Résumé des règles de flux

1. **Channel Runtime** est le seul point d'entrée et de sortie utilisateur.
2. **Identity Runtime** authentifie avant tout traitement.
3. **LLM Runtime** ne produit que des intentions.
4. **Decision Runtime** est le seul à créer un plan.
5. **Policy Runtime** valide avant exécution.
6. **Action Runtime** est le seul à appeler un plugin.
7. **Workflow Runtime** passe par Action Runtime à chaque étape.
8. **Event Runtime** reçoit tous les événements.
9. **Memory Runtime** est consulté et mis à jour à chaque interaction.
10. **Knowledge Runtime** est consulté en lecture seule.
11. **Skill Runtime** génère les réponses et gère les interactions spécialisées.
12. **Observability Runtime** trace tout.

---

> Document conceptuel. Aucune modification du code source n'a été effectuée.
