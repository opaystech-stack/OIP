# OIP - Ecosysteme Open Source et Adapters

## Principe

OIP depend d'interfaces, pas directement d'outils externes.

Toute dependance externe doit pouvoir etre remplacee rapidement en modifiant uniquement son adapter. Le coeur de la plateforme ne doit pas dependre de ZVec, LangGraph, MCP, Langfuse ou d'un fournisseur IA specifique.

## Adapters Cibles

- LLM Adapter
- Vector Adapter
- Knowledge Adapter
- OCR Adapter
- Automation Adapter
- Workflow Adapter
- Observability Adapter
- Memory Adapter
- Voice Adapter
- MCP Adapter

## Workflow

### LangGraph

Repository: https://github.com/langchain-ai/langgraph

Usage cible:

- orchestration d'agents
- workflows complexes
- human-in-the-loop
- reprise apres erreur
- memoire de workflow

LangGraph peut servir de base technique au Workflow Engine, derriere un Workflow Adapter.

## Communication Outils

### Model Context Protocol

Repository: https://github.com/modelcontextprotocol

Usage cible:

- standardiser l'acces aux outils
- connecter GitHub, PostgreSQL, Google Drive, fichiers, APIs et services internes
- exposer des outils internes sous forme de connecteurs

## Knowledge Engine

### ZVec

Repository: https://github.com/alibaba/zvec

Usage cible:

- recherche semantique
- similarite
- resolution d'entites
- memoire documentaire

ZVec ne remplace jamais la base metier.

### Docling

Repository: https://github.com/docling-project/docling

Usage cible:

- parsing PDF
- Word
- Excel
- PowerPoint
- HTML
- Markdown
- documents structures pour RAG

### MarkItDown

Repository: https://github.com/microsoft/markitdown

Usage cible:

- conversion universelle vers Markdown avant indexation

### PaddleOCR

Repository: https://github.com/PaddlePaddle/PaddleOCR

Usage cible:

- factures
- contrats
- images
- documents scannes
- tickets

## UI Automation

### Page Agent

Repository: https://github.com/alibaba/page-agent

Usage limite:

- onboarding
- visite guidee
- mise en evidence
- tutoriels
- aide contextuelle
- demonstration

Toutes les operations metier passent par l'Action Engine.

## Memoire Code

### Codebase Memory MCP

Repository: https://github.com/DeusData/codebase-memory-mcp

Usage cible:

- comprehension du code
- navigation intelligente
- documentation automatique
- assistance developpeur

Cette memoire est reservee a l'equipe technique, pas aux utilisateurs finaux.

## Local AI

### Ollama

Repository: https://github.com/ollama/ollama

Usage cible:

- execution locale
- confidentialite
- mode hors ligne

## Observabilite

### OpenTelemetry

Repository: https://github.com/open-telemetry/opentelemetry-js

Usage cible:

- temps d'execution
- erreurs
- appels API
- appels LLM
- traces techniques

### Langfuse

Repository: https://github.com/langfuse/langfuse

Usage cible:

- conversations
- couts
- prompts
- versions
- debugging
- evaluation IA

## Validation

### Guardrails AI

Repository: https://github.com/guardrails-ai/guardrails

Usage cible:

- validation JSON
- contraintes
- controle qualite
- securite de sortie

## Automatisation

### n8n

Repository: https://github.com/n8n-io/n8n

Usage cible:

- email
- WhatsApp
- Telegram
- Slack
- ERP
- CRM
- automatisations externes

## Voice Adapter

Le moteur vocal reste abstrait. Implementations futures possibles:

- Whisper pour reconnaissance vocale
- Piper pour synthese vocale locale
- Kokoro TTS pour voix naturelles

## Recherche Hybride

OIP doit combiner:

- SQLite ou PostgreSQL
- FTS5 ou recherche plein texte native
- ZVec ou autre moteur vectoriel

Objectif:

- recherche exacte
- recherche plein texte
- recherche semantique

