# Company Decisions Archive

## Decision: Adopt Local AI Infrastructure

**Date:** September 20, 2026
**Decided by:** Alice (Engineering Lead)
**Status:** Approved

The company voted to adopt local AI infrastructure for all engineering teams. All inference runs on local Ollama models. No data leaves the organization's network.

**Rationale:** Data sovereignty is non-negotiable for enterprise operations. Client data, internal communications, and strategic documents must never be processed by third-party cloud APIs.

**Participants:** Alice, Bob, Charlie, Diana
**Related:** Project Alpha, Data Sovereignty Policy

## Decision: Implement Graph-Based Knowledge Management

**Date:** September 22, 2026
**Decided by:** Charlie (Data Architect)
**Status:** Approved

All knowledge management will use a graph-based approach. Entities (people, projects, decisions, concepts) are linked through explicit relationships. Queries traverse both vector space and graph structure.

**Rationale:** Traditional keyword search misses the relational context between decisions and their outcomes. Graph-based retrieval surfaces connections that would otherwise be invisible.

**Participants:** Charlie, Alice
**Related:** Knowledge Graph Engine, Project Alpha

## Decision: Approval Gates for Agent Actions

**Date:** September 26, 2026
**Decided by:** Bob (Security Architect)
**Status:** Pending Review

All autonomous agent actions with write or execute risk level must pass through a human approval gate before execution. This ensures controlled execution with full auditability.

**Rationale:** The sovereign agent can read, write, and execute system commands. Without human oversight, this capability creates unacceptable risk. The approval gate provides a safety net while preserving agent autonomy for read-only operations.

**Participants:** Bob, Alice, Diana
**Risk Level:** Write, Execute, Dangerous
**Related:** Approval Gate System, Project Alpha Phase 3
