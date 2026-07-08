# Opays Intelligence Platform

Opays Intelligence Platform (OIP) est le moteur d'intelligence conversationnelle centralise d'Opays. Son role n'est pas d'ajouter un chatbot aux applications existantes, mais de faire du langage naturel l'interface principale des produits Opays.

Le principe fondateur est simple: les applications metier declarent leurs capacites, leurs workflows, leurs permissions et leurs sources de connaissance. OIP comprend la demande de l'utilisateur, construit le contexte, planifie l'action, valide les risques, orchestre le workflow, puis execute via les services metier autorises.

## Vision

Construire une plateforme d'intelligence reutilisable pour plusieurs secteurs:

- Commerce
- RH
- Immobilier
- Cadastre
- Juridique
- Logistique
- ONG
- Sante
- Education
- Futurs produits Opays

OIP doit fonctionner depuis plusieurs interfaces sans changer son architecture:

- Web
- Mobile Expo
- WhatsApp
- Telegram
- API
- Voix
- Agents autonomes

## Principe Critique

Le LLM ne possede aucun droit d'execution directe.

Il ne fait jamais de SQL, HTTP direct, DOM direct ou appel service metier direct. Il choisit uniquement une capacite declaree. L'Action Engine execute apres validation.

## Documentation

- [Vision et architecture](docs/oip-vision-architecture.md)
- [Roadmap MVP](docs/oip-mvp-roadmap.md)
- [Ecosysteme open source et adapters](docs/oip-open-source-adapters.md)
- [Structure cible du repository](docs/oip-repository-structure.md)
- [Etat d'implementation](docs/oip-implementation-status.md)

## Demarrage Technique

Le socle actuel est un monorepo TypeScript minimal sans dependance externe.

Commandes:

```bash
npm run check
npm test
npm run demo
npm run dev:api
```

La demo prouve le premier flux OIP:

```text
langage naturel -> Planner -> Capability -> Validator -> Action Engine -> Tool Commerce -> Event Bus
```

Le socle contient aussi les premiers contrats pour:

- LLM Adapter
- OpenAI-compatible LLM Adapter
- OipRuntime
- Workflow Engine
- Knowledge Engine
- Context Builder
- Plugin Commerce
- Plugin HR
- Adapters externes: Vector, Document, OCR, Observability, Automation, MCP

## API Locale

Demarrer l'API:

```bash
npm run dev:api
```

Endpoints:

- `GET /health`
- `GET /capabilities`
- `POST /chat`
- `POST /actions`
- `POST /documents`
- `GET /admin/audit`
- `GET /admin/traces`
- `GET /admin/events`

Exemple `POST /chat`:

```json
{
  "input": "Ajoute 20 sacs de ciment au stock",
  "user": {
    "userId": "user-001",
    "organizationId": "opays-demo",
    "roles": ["inventory.manager"],
    "locale": "fr-CD"
  }
}
```

Configuration LLM:

```bash
OIP_LLM_PROVIDER=mock
OIP_LLM_PROVIDER=openai-compatible
OIP_LLM_BASE_URL=https://api.openai.com/v1
OIP_LLM_API_KEY=...
OIP_LLM_MODEL=gpt-4.1-mini
```
