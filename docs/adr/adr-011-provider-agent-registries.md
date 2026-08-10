---
status: accepted
date: 2026-07-21
title: ADR-011 — Registres Provider et Agent gouvernes
---

# ADR-011 : Registres Provider et Agent gouvernes

## Decision

Les fournisseurs IA sont enregistres par capacites (`json`, `embedding`,
`streaming`, etc.) derriere `LlmRuntime`. Le runtime et les produits ne
referencent jamais un fournisseur concret.

Les agents sont des definitions gouvernees : identite, capacites, scopes de
memoire, budget, permissions, tools, policies et preference de provider. Ils
ne sont pas des prompts. Le Decision Engine selectionne un agent seulement a
partir de l'intention et du registre.

## Etat

Les registres en memoire constituent le contrat et la selection canonique P1.
La persistence, le budget comptable et le controle-plane multi-tenant restent
P2/P3 ; ils ne sont pas presentes comme implementes.
