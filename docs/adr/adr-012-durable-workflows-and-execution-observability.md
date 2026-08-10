---
status: accepted
date: 2026-07-21
title: ADR-012 — Workflows durables et observabilite d'execution
---

# ADR-012 : Workflows durables et observabilite d'execution

## Decision

`WorkflowRuntime` expose desormais `start`, `signal`, `resume`,
`compensate` et `getState`. Son etat passe par le port
`WorkflowExecutionStore`; une implementation in-memory est strictement une
reference de test, pas un backend de production.

Le runtime canonique peut executer une etape workflow seulement apres la
decision de `PolicyRuntime`. Chaque transition de workflow genere un evenement
et un audit.

Chaque requete canonique produit un `RuntimeExecutionRecord` independant du
provider : intention, decision, plan, agent, actions, duree et erreur. Les
champs provider, tokens et cout sont prevus pour les adapters de production.

## Consequences

- Aucun workflow ne doit etre implemente comme une boucle de chat.
- La production doit injecter un store durable et une sink d'observabilite.
- Les enregistrements in-memory prouvent le cycle, mais ne constituent pas une
  retention ou une conformite de production.
