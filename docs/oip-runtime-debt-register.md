# Registre de dette Runtime OIP

Mis a jour : 2026-07-18

## P0

- Runtime et contrats canoniques uniques ; migration des frontieres legacy.
- Identity/Policy obligatoires pour les gateways. L'adapter in-memory est
  fail-closed et reserve au test ; brancher un adapter JWT/SSO de production.
- Context relie a Memory et Knowledge ; LLM limite a l'intention.

## P1

- Provider Registry par capacites et Agent Registry gouverne.
- Memoires typees avec retention, consentement et isolation workspace.
- Knowledge persistant avec ACL et provenance.

## P2

- Le contrat workflow est persistant/reprenable/compensable/auditable ; brancher
  un `WorkflowExecutionStore` durable et des handlers de production.
- Remplacer l'observabilite in-memory par une sink distribuee et relier les
  adapters provider aux champs cout/tokens/model.
- Event log/outbox transactionnel et stores multi-tenant.
