"""AegisMind Sovereign Second Brain — Live Demo Script.

Run this to demonstrate the full system:
1. Document ingestion
2. Knowledge graph construction
3. Semantic retrieval
4. Agent reasoning with graph context
5. Approval gate demonstration
"""
from __future__ import annotations

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))
sys.path.insert(0, str(Path(__file__).parent.parent / "packages" / "aegismind-core" / "src"))
sys.path.insert(0, str(Path(__file__).parent.parent / "packages" / "aegismind-graph" / "src"))
sys.path.insert(0, str(Path(__file__).parent.parent / "packages" / "aegismind-approval" / "src"))
sys.path.insert(0, str(Path(__file__).parent.parent / "packages" / "aegismind-retrieval" / "src"))
sys.path.insert(0, str(Path(__file__).parent.parent / "packages" / "aegismind-types" / "src"))
sys.path.insert(0, str(Path(__file__).parent.parent / "packages" / "aegismind-ingestion" / "src"))
sys.path.insert(0, str(Path(__file__).parent.parent / "packages" / "aegismind-infra" / "src"))
sys.path.insert(0, str(Path(__file__).parent.parent / "packages" / "aegismind-connector-sdk" / "src"))
sys.path.insert(0, str(Path(__file__).parent.parent / "packages" / "aegismind-identity" / "src"))

from aegismind_core.routes import CoreState
from aegismind_graph.engine import KnowledgeGraphEngine
from aegismind_approval.gate import ApprovalGate


async def demo() -> None:
    """Run the full sovereign brain demo."""
    print("=" * 60)
    print("  AEGISMIND SOVEREIGN SECOND BRAIN — DEMO")
    print("=" * 60)

    # Initialize core state
    state = CoreState()

    # 1. Knowledge Graph Demo
    print("\n[1/5] KNOWLEDGE GRAPH")
    print("-" * 40)
    graph = state.graph_engine
    stats = graph.get_stats()
    print(f"  Nodes: {stats['total_nodes']}, Edges: {stats['total_edges']}")
    print(f"  Node types: {stats['node_types']}")

    # Query graph
    result = graph.query(query="Alice", limit=5)
    print(f"\n  Query 'Alice' found {result.total_count} nodes:")
    for node in result.nodes:
        print(f"    - [{node.entity_type}] {node.name} (connections: {len(node.connections)})")

    # 2. Document Ingestion Demo
    print("\n[2/5] DOCUMENT INGESTION")
    print("-" * 40)
    # The ingestion pipeline is available via state.ingestion_pipeline
    print("  Ready to ingest documents from ./demo_data/")
    demo_files = list(Path("./demo_data").glob("*.md"))
    print(f"  Found {len(demo_files)} demo documents")
    for f in demo_files:
        print(f"    - {f.name}")

    # 3. Semantic Retrieval Demo
    print("\n[3/5] SEMANTIC RETRIEVAL")
    print("-" * 40)
    if state.retrieval_pipeline:
        print("  Retrieval pipeline initialized")
        result = await state.retrieval_pipeline.execute(
            query="sovereign AI platform",
            principal={"id": "alice", "type": "user", "tenant_id": "corp-default"},
            top_k=5,
        )
        print(f"  Found {len(result.results)} authorized chunks")
    else:
        print("  Retrieval pipeline not yet initialized (will start on first request)")

    # 4. Approval Gate Demo
    print("\n[4/5] APPROVAL GATE")
    print("-" * 40)
    gate = state.approval_gate
    print(f"  Pending: {gate.get_pending()}")

    # Propose an action
    proposal = gate.propose(
        tool_name="run_local_command",
        arguments={"cmd": "git status"},
        reasoning="User asked to check git status for the project",
        risk_level="read",
    )
    print(f"  Proposed action: {proposal.id} (risk: {proposal.risk_level})")

    pending = gate.get_pending()
    print(f"  Pending actions: {len(pending)}")
    for p in pending:
        print(f"    - {p.summary}")

    # 5. Full System Status
    print("\n[5/5] SYSTEM STATUS")
    print("-" * 40)
    print(f"  Graph engine: {graph._graph_path}")
    print(f"  Approval gate: {gate._approval_log_path}")
    print(f"  Vector store: {type(state.vector_store).__name__}")
    print(f"  Audit log entries: {len(state.audit_log)}")
    print(f"  Indexed resources: {len(state.indexed_resources)}")
    print(f"  Connectors: {len(state.connectors)}")

    print("\n" + "=" * 60)
    print("  DEMO COMPLETE — Start the web UI with:")
    print("  Terminal 1: uv run uvicorn aegismind_core.app:app --reload --port 8000")
    print("  Terminal 2: pnpm --filter lens dev")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(demo())
