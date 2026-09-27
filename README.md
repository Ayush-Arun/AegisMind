# AegisMind: Enterprise Knowledge Engine with Zanzibar ACL & n8n Automation

Modular enterprise knowledge platform and offline sovereign AI agent with document-level Zanzibar access control enforced at retrieval.

[![Python 3.12+](https://img.shields.io/badge/python-3.12%2B-blue.svg)](https://www.python.org/downloads/)
[![Architecture](https://img.shields.io/badge/architecture-hexagonal%20%2F%20ports%20%26%20adapters-orange.svg)](#architecture)
[![Authz](https://img.shields.io/badge/authz-Zanzibar%20%2F%20SpiceDB-green.svg)](#permission-and-security-model)
[![Linter](https://img.shields.io/badge/linter-ruff-purple.svg)](https://github.com/astral-sh/ruff)
[![Tests](https://img.shields.io/badge/tests-194%20passing-brightgreen.svg)](#testing-and-quality)
[![Frontend](https://img.shields.io/badge/UI-React%2019%20%2F%20Vite-cyan.svg)](apps/lens)

---

AegisMind is an open-source, modular enterprise knowledge and retrieval platform engineered around clean hexagonal architecture (Ports and Adapters). It guarantees mathematical document-level authorization using Google Zanzibar-style Relation-Based Access Control (ReBAC) powered by SpiceDB.

In addition to enterprise-scale multi-tenant retrieval, AegisMind includes a **Local Sovereign Agent Mode**: a 100% offline, air-gapped personal intelligence layer that runs locally alongside the enterprise stack. It utilizes local Ollama models, zero-network ONNX embeddings, a lightweight SQLite vector store, and strictly sandboxed system tools.

---

## Key Features

- **Knowledge Graph Engine**: Persistent local knowledge graph connecting people, projects, concepts, and decisions. Entity extraction, relationship linking, and graph-aware retrieval for the sovereign second brain. All data persists to local JSON files — zero cloud dependency.
- **Approval Gate with Human-in-the-Loop**: Every agent action with write or execute risk level requires explicit human approval before execution. Proposals are registered, reviewed, and audited with full transparency. Controlled execution with complete auditability.
- **Authz-Before-Rerank Pipeline**: Document permissions are evaluated *during* retrieval before cross-encoder reranking and token budgeting. Unauthorized chunks are purged upfront, preventing permission leakage, cache poisoning, and prompt injection attacks.
- **7-Stage Hybrid Retrieval**:
  1. Input validation and query preprocessing
  2. Dense vector search and BM25/lexical sparse search
  3. Reciprocal Rank Fusion (RRF)
  4. Candidate Overfetching (3x to 5x requested top_k)
  5. Bulk Zanzibar Authorization check with `at_least_as_fresh` consistency
  6. Cross-encoder relevance reranking
  7. Token budgeting and synthesis
- **Local Sovereign Agent Mode**: Completely air-gapped personal agentic workflow operating on local machines. Zero external API calls, zero cloud dependencies.
- **Sandboxed Agent Tools**:
  - `search_local_knowledge`: Queries local offline vector storage.
  - `read_system_file`: Access restricted strictly to allowlisted root directories; path traversal (`..`) is strictly blocked.
  - `create_note`: Persists structured Markdown notes with YAML frontmatter to `.aegismind/notes/`.
  - `run_local_command`: Strictly restricted to an allowlist of read-only diagnostic utilities, rejects all shell metacharacters, executed via `shlex.split` argv lists with timeout and structured audit logs.
- **Sovereign Embeddings and Storage**: Pluggable support for zero-GPU ONNX embeddings via FastEmbed (`bge-small-en-v1.5`), local Ollama embeddings, and an in-process SQLite vector store supporting dense cosine, lexical, and hybrid search.
- **Extensible Connector SDK**: Ingest data from 15+ sources with strict conformance tests, change detection, and sensitive-path denylists.
- **Lens Web UI**: Clean React 19 interface with real-time Chat, Knowledge Graph visualization, Approval Gate panel, Datasets exploration, Notes Vault, and live Local Tools transparency audit feed.

---

## Architecture

AegisMind strictly follows the Ports and Adapters (hexagonal) pattern. Domain logic, service boundaries, and pipeline abstractions define pure Python protocols (Ports). Concrete storage engines, embedders, authorization backends, and models (Adapters) register via Python entry points and are resolved dynamically at runtime through `aegismind_core.registry`.

```
                              +---------------------------------------+
                              |         Lens Web UI (React 19)        |
                              |  [Chat] [Graph] [Approvals] [Notes]  |
                              |  [Tools] [Datasets] [Access]         |
                              +-------------------+-------------------+
                                                  | HTTP / REST
                                                  v
 +------------------------------------------------------------------------------------+
 |                               Agora API Server (FastAPI)                           |
 +----------------------------------------+-------------------------------------------+
 | Enterprise RAG Pipeline                | Local Sovereign Agent                     |
 | 1. Query Preprocessing                 | - SovereignAgentLoop (ReAct Engine)       |
 | 2. Dense + Lexical Search              | - Knowledge Graph Context Enrichment      |
 | 3. Reciprocal Rank Fusion (RRF)        | - Approval Gate (Human-in-the-Loop)     |
 | 4. Overfetch (3x-5x top_k)             | - Sandboxed System Tools                  |
 | 5. Bulk Zanzibar Authz (SpiceDB)       | - Graph-Aware Reasoning                  |
 | 6. Cross-Encoder Reranking             | - Structured Audit Logging               |
 | 7. Token Budgeting & Synthesis         |                                          |
 +-------------------+--------------------+---------------------+---------------------+
                     |                                          |
                     v                                          v
 +----------------------------------------+   +---------------------------------------+
 | Enterprise Adapters (Scale)            |   | Sovereign Adapters (Air-Gapped)     |
 | - Postgres + pgvector Storage          |   | - SQLite Vector Store               |
 | - SpiceDB Zanzibar ReBAC               |   | - Knowledge Graph (Local JSON)      |
 | - HuggingFace TEI Embedder & Reranker  |   | - Approval Gate (Pending Queue)     |
 +----------------------------------------+   | - Local Filesystem Connector         |
                                             +---------------------------------------+
```

### New Components (Sovereign Brain)

- **Knowledge Graph Engine** (`aegismind-graph`): Persistent entity-relationship graph with BFS traversal, entity extraction, and graph-aware prompt enrichment
- **Approval Gate** (`aegismind-approval`): Human-in-the-loop approval system with proposal registration, review queue, and full audit trail

---

## Workspace Structure

The repository is organized as a monorepo managed with `uv` workspaces for Python and `pnpm` workspaces for TypeScript:

```
aegisMind/
├── packages/
│   ├── aegismind-core/          # FastAPI Agora server, orchestration, registry, sovereign agent
│   ├── aegismind-types/         # Domain models, chunk structures, authorization envelopes
│   ├── aegismind-authz/         # SpiceDB Zanzibar ReBAC adapter and in-memory authorization
│   ├── aegismind-retrieval/     # Vector stores (pgvector, SQLite), embedders, rerankers, RRF
│   ├── aegismind-ingestion/     # Text chunking, document parsers, versioning
│   ├── aegismind-identity/      # Identity propagation and group alias expansion
│   ├── aegismind-infra/         # Secrets manager and object storage adapters
│   ├── aegismind-connector-sdk/ # Connector interface, verify harness, manifest validator
│   └── aegismind-mcp-bridge/    # Model Context Protocol bridge
├── connectors/
│   ├── local_filesystem/        # Offline filesystem connector with security denylists
│   ├── confluence/              # Atlassian Confluence connector
│   ├── github/                  # GitHub repositories and pull requests connector
│   ├── google_drive/            # Google Drive connector
│   ├── jira/                    # Jira issue tracking connector
│   ├── notion/                  # Notion workspace connector
│   ├── slack/                   # Slack conversation connector
│   └── ...                      # Dropbox, Gmail, Granola, Linear, Salesforce, Teams, Zendesk
├── apps/
│   └── lens/                    # React 19 + Vite web interface
├── deploy/
│   ├── docker/                  # Production Dockerfiles
│   └── migrations/              # Database schema migrations
└── tests/                       # Unit, integration, security guardrail, and agent test suites
```

---

## Quickstart: Running AegisMind

### Fork & Run (for everyone who clones/forks this repo)

If you forked this repository, run these commands to get started:

#### 1. Start Ollama
Ensure Ollama is running and pull the required models:
```powershell
ollama serve
ollama pull llama3.2:latest
ollama pull nomic-embed-text:latest
ollama pull qwen2.5:7b
```

#### 2. Run the Setup Script (one command!)
```powershell
Set-Location -LiteralPath "path\to\aegismind"
.\scripts\setup.ps1
```
This installs all dependencies, pulls models, and seeds the knowledge graph automatically.

#### 3. Start Everything
```powershell
.\scripts\start.ps1
```
Or manually:
```powershell
# Terminal 1 — Backend API
uv run uvicorn aegismind_core.app:app --reload --port 8000

# Terminal 2 — Frontend
pnpm --filter lens dev
```

#### 4. Open the App
[http://localhost:3000](http://localhost:3000)

#### Without the setup script (manual):
```powershell
# One-time dependency installation
uv sync --all-groups
uv pip install -e packages/aegismind-graph
uv pip install -e packages/aegismind-approval
uv pip install -e packages/aegismind-core

# Seed the knowledge graph (required!)
python scripts/seed_graph.py

# Start backend (Terminal 1)
uv run uvicorn aegismind_core.app:app --reload --port 8000

# Start frontend (Terminal 2)
pnpm --filter lens dev
```

Open [http://localhost:3000](http://localhost:3000)

---

### Option 1: Local Sovereign Agent Mode (100% Offline)

This mode operates completely on your machine without external cloud dependencies.

---

### Option 2: Full Enterprise Stack (Docker Compose)

To spin up the complete enterprise infrastructure (PostgreSQL with pgvector, SpiceDB, HuggingFace TEI Embedder, TEI Reranker, and Agora API):

```powershell
docker compose up -d
```

Verify service health:
```powershell
docker compose ps
```

---

## Permission and Security Model

AegisMind treats authorization correctness as non-negotiable:

1. **Authz-Before-Rerank**:
   Standard RAG architectures rerank documents before filtering, which leaks document existence and wastes cross-encoder compute. AegisMind overfetches candidates (3x to 5x), checks all candidate chunk IDs in a single bulk call to SpiceDB, purges unauthorized items, and only passes authorized chunks to the reranker and synthesis stages.

2. **Zanzibar ReBAC Consistency**:
   All authorization checks execute with `at_least_as_fresh` consistency tokens, preventing stale permission evaluations after access revocation.

3. **Sovereign Agent Sandboxing**:
   - Path Traversal Guard: Any path containing `..` or targeting outside configured allowlist root directories is rejected before filesystem operations.
   - Command Execution Guard: Shell metacharacters (`;`, `|`, `&`, backticks, redirects) are rejected. Commands are tokenized via `shlex.split`, matched against an allowlist of read-only diagnostics, executed with strict timeouts, and recorded in structured audit logs.
   - Ingestion Denylist: Files matching `.ssh/`, `.env`, `*credentials*`, `*id_rsa*`, `.aws/`, `*.pem`, or `*.key` are skipped during indexing.

---

## Testing and Quality

AegisMind maintains strict quality standards across all packages.

### Run Unit and Agent Tests
```powershell
uv run pytest -v
```

### Run Static Type Checking
```powershell
uv run mypy packages connectors tests
```

### Run Code Formatting and Linting
```powershell
uv run ruff check .
uv run ruff format --check .
```

### Build Frontend
```powershell
pnpm --filter lens build
```

---

## Why This Wins: Hackathon Highlights

### 🧠 Sovereign Second Brain
Every piece of knowledge — decisions, people, projects, concepts — is connected through a persistent, local knowledge graph. No data ever leaves the machine.

### 🔒 Human-in-the-Loop Approval Gate
Every agent action with write or execute risk level requires explicit human approval before execution. Full audit trail. Zero unchecked autonomy.

### 📊 Live Knowledge Graph Visualization
The frontend renders the entire knowledge graph as an interactive SVG visualization. Users can see how concepts, people, and decisions are connected in real time.

### 🏗️ Hexagonal Architecture at Scale
Domain logic is isolated from infrastructure. Every adapter (storage, authz, embedders, LLMs) is pluggable via Python entry points and dynamic registry resolution.

### 🔐 Enterprise-Grade Authz with Zanzibar ReBAC
Document-level authorization is enforced during retrieval *before* reranking. `at_least_as_fresh` consistency prevents permission leakage after access revocation.

### 🌐 Fully Offline Capable
The sovereign agent mode runs entirely locally with Ollama models, ONNX embeddings, and a SQLite vector store. Zero cloud dependencies.

### 📜 Production-Ready Code Quality
- 194+ passing tests
- Ruff linting and formatting
- Mypy type checking
- Structured audit logging throughout

### 🎯 Demo-Ready
`make setup && make start` gets a fully working demo running in minutes.

---

## License

Apache License 2.0. See [LICENSE](LICENSE) for details.
