# Architecture canonique executable OIP

Statut : P0 en implementation — 2026-07-18

## Cycle

```text
InboundRequest -> Identity -> Context(Memory, Knowledge) -> Intent
-> Decision -> Policy -> Action/Workflow -> Events/Audit/Memory -> Response
```

Invariants :

1. Une action sans policy `allow` ne s'execute pas.
2. L'identite provient d'un `IdentityRuntime`, jamais d'un body HTTP.
3. Une metadata client ne constitue jamais une confirmation.
4. Le LLM est limite a l'intention et ne connait pas les tools.
5. Le runtime public ne connait aucun fournisseur IA concret.

L'adapter in-memory est volontairement fail-closed : seuls les utilisateurs
explicitement enregistres peuvent etre authentifies. Il n'est pas un provider
Identity de production.
