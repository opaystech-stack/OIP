---
status: accepted
date: 2026-07-18
title: ADR-010 — Runtime OIP canonique et cycle d'execution gouverne
---

# ADR-010 : Runtime OIP canonique et cycle d'execution gouverne

## Decision

`OipRuntime` devient la facade du runtime canonique. Toute nouvelle entree
runtime execute strictement :

`Identity -> Context -> Intent -> Decision -> Policy -> Execution -> Memory -> Event -> Response`.

Le LLM produit uniquement une intention structuree. Il ne recoit aucun registre
de tools et ne choisit ni capability ni workflow. La gateway ne peut plus
accepter les roles ou confirmations depuis un body HTTP.

Les chemins `ComposedRuntime`, `LlmPlanner` et l'execution directe restent des
compatibilites de migration seulement ; aucun nouveau transport ne les utilise.

## Fermeture du chantier

Une validation runtime doit prouver une requete authentifiee qui charge le
contexte memory/knowledge, est decidee, autorisee par policy, executee,
auditee, memorisee et emet ses evenements.
