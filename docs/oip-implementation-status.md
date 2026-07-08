# OIP - Implementation Status

## Implemented

- TypeScript monorepo foundation
- Core contracts: Capability, Tool, Plugin, RuntimeContext, PlannedAction
- Capability Registry
- Tool Registry
- Validator with RBAC and confirmation policy
- Action Engine
- Event Bus
- Audit Log
- Workflow Engine
- LLM Adapter interface
- Mock LLM Adapter
- OpenAI-compatible LLM Adapter
- LLM Planner
- Context Builder
- Knowledge Engine
- Document Service with text chunking
- Conversation Memory
- Observability Adapter with in-memory traces
- Plugin SDK
- OipRuntime facade
- Commerce plugin
- HR plugin
- HTTP API
- GitHub Actions CI

## API Endpoints

- `GET /health`
- `GET /capabilities`
- `POST /chat`
- `POST /actions`
- `POST /documents`
- `GET /admin/audit`
- `GET /admin/traces`
- `GET /admin/events`

## Verified

Current verification commands:

```bash
npm run check
npm test
npm run demo
```

The test suite verifies:

- LLM-planned Commerce action execution
- RBAC rejection
- malformed LLM plan rejection
- workflow orchestration
- context enrichment
- runtime plugin installation
- OpenAI-compatible adapter JSON parsing
- chat end-to-end flow
- default mock LLM configuration
- document ingestion and search
- confirmation blocking for sensitive capabilities
- multi-plugin runtime with Commerce and HR
- HTTP API health, capability discovery, chat, action execution and admin state

## Still Mocked or In-Memory

- Business persistence is in-memory
- Conversation memory is in-memory
- Audit log is in-memory
- Event bus is in-memory
- Observability traces are in-memory
- Document parsing accepts extracted text only
- Vector search is lexical/in-memory, not ZVec yet
- LLM provider defaults to mock unless env vars are configured

## Next Integrations

- Replace in-memory stores with SQLite/PostgreSQL adapters
- Add ZVec adapter behind `VectorAdapter`
- Add Docling/MarkItDown ingestion behind `DocumentAdapter`
- Add OCR adapter behind `OcrAdapter`
- Add OpenTelemetry/Langfuse implementations behind observability adapters
- Add MCP adapter implementation
- Add WhatsApp/Telegram/mobile clients on top of the same API/runtime
