# OIP - Implementation Status

## Release status — v0.1.0-alpha.1

**CONSOLIDATED & READY**

The public OIP API, the governed Capability Gateway, the official MCP
stdio/in-memory transports, and the TanStack AI Memory integration are
consolidated and ready for the alpha release candidate. The public execution
path preserves authenticated identity, tenant scope, policy evaluation,
confirmation, post-execution verification, provenance and audit evidence.

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
- Plain text document adapter
- Mock OCR adapter contract implementation
- Vector Adapter contract
- In-memory vector adapter with cosine similarity
- Hybrid lexical/vector search
- Conversation Memory
- JSON-file persistence for memory, audit and events
- Observability Adapter with in-memory traces
- Plugin SDK
- OipRuntime facade
- Governed Capability Gateway with discovery, policy, tenant scope and verification
- Official MCP transport exposing the governed capability surface
- TanStack AI Memory middleware with tenant/user/thread-scoped OIP adapter
- Injectable persistent MemoryAdapter provider through OipRuntime options
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
npm run build
npm run test:all
npm run demo
npm pack --dry-run
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
- binary text document ingestion through `DocumentAdapter`
- OCR ingestion path through `OcrAdapter`
- vector nearest-neighbor search
- hybrid lexical/vector search
- confirmation blocking for sensitive capabilities
- multi-plugin runtime with Commerce and HR
- HTTP API health, capability discovery, chat, action execution and admin state
- JSON-file persistence across runtime/API restarts
- Capability Gateway discovery, policy enforcement, execution and verification
- MCP in-memory and stdio transport initialization, discovery and governed invocation
- TanStack AI Memory recall/save, tenant isolation and validated thread scope
- Injectable MemoryAdapter provider through the public OipRuntime facade
- npm package boundary excluding source tests, examples and documentation
- Commerce demo execution through Capability Gateway with verified inventory evidence

## Still Mocked or In-Memory

- Business persistence is in-memory
- Conversation memory defaults to in-memory unless `OIP_DATA_DIR` or an injectable
  TanStack-compatible `MemoryAdapter` provider is configured
- Audit log defaults to in-memory unless `OIP_DATA_DIR` is configured
- Event bus defaults to in-memory unless `OIP_DATA_DIR` is configured
- Observability traces are in-memory
- Document parsing supports extracted text and binary text through a plain adapter
- OCR path is wired through an adapter, but production OCR is not integrated yet
- Vector search has an in-memory adapter; ZVec is not integrated yet
- LLM provider defaults to mock unless env vars are configured

## Next Integrations

- Configure a production durable memory provider (Redis or a compatible SQLite/PostgreSQL adapter)
- Add ZVec adapter behind `VectorAdapter`
- Add Docling/MarkItDown ingestion behind `DocumentAdapter`
- Add OCR adapter behind `OcrAdapter`
- Add OpenTelemetry/Langfuse implementations behind observability adapters
- Add MCP adapter implementation
- Add WhatsApp/Telegram/mobile clients on top of the same API/runtime
