"""Seed the AegisMind knowledge graph with demo data."""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "packages" / "aegismind-graph" / "src"))
sys.path.insert(0, str(Path(__file__).parent.parent / "packages" / "aegismind-core" / "src"))
sys.path.insert(0, str(Path(__file__).parent.parent))

from aegismind_graph.engine import KnowledgeGraphEngine
from aegismind_graph.models import KnowledgeEdge, KnowledgeNode


async def seed_graph() -> None:
    """Populate the knowledge graph with demo entities and relationships."""
    graph = KnowledgeGraphEngine(graph_path="./storage/graph/graph.json")

    # Create demo nodes
    nodes = [
        KnowledgeNode(
            id="person:alice",
            entity_type="person",
            name="Alice",
            properties={"role": "Engineering Lead", "department": "Engineering"},
            source_query="Team introduction",
        ),
        KnowledgeNode(
            id="person:bob",
            entity_type="person",
            name="Bob",
            properties={"role": "Security Architect", "department": "Security"},
            source_query="Team introduction",
        ),
        KnowledgeNode(
            id="person:charlie",
            entity_type="person",
            name="Charlie",
            properties={"role": "Data Architect", "department": "Data"},
            source_query="Team introduction",
        ),
        KnowledgeNode(
            id="project:alpha",
            entity_type="project",
            name="Project Alpha",
            properties={
                "status": "active",
                "phase": "Phase 2",
                "description": "Sovereign AI Platform",
            },
            source_query="Project Alpha overview",
        ),
        KnowledgeNode(
            id="decision:local_inference",
            entity_type="decision",
            name="Decision: Local Inference",
            properties={"date": "2026-09-20", "status": "approved"},
            source_query="Team decisions",
        ),
        KnowledgeNode(
            id="concept:data_sovereignty",
            entity_type="concept",
            name="Data Sovereignty",
            properties={"importance": "critical"},
            source_query="Architecture principles",
        ),
        KnowledgeNode(
            id="concept:zanzibar_acl",
            entity_type="concept",
            name="Zanzibar ACL",
            properties={"system": "SpiceDB"},
            source_query="Architecture principles",
        ),
        KnowledgeNode(
            id="project:beta",
            entity_type="project",
            name="Project Beta",
            properties={"status": "planning", "phase": "Phase 1"},
            source_query="Future roadmap",
        ),
        KnowledgeNode(
            id="decision:approval_gates",
            entity_type="decision",
            name="Decision: Approval Gates",
            properties={"date": "2026-09-26", "status": "pending"},
            source_query="Security decisions",
        ),
    ]

    for node in nodes:
        graph.add_node(node)

    # Create relationships
    edges = [
        KnowledgeEdge(
            source="person:alice", target="project:alpha", relation="leads", confidence=1.0
        ),
        KnowledgeEdge(
            source="person:bob", target="project:alpha", relation="secures", confidence=1.0
        ),
        KnowledgeEdge(
            source="person:charlie", target="project:alpha", relation="architects", confidence=1.0
        ),
        KnowledgeEdge(
            source="decision:local_inference",
            target="project:alpha",
            relation="decided",
            confidence=1.0,
        ),
        KnowledgeEdge(
            source="concept:data_sovereignty",
            target="decision:local_inference",
            relation="influenced",
            confidence=0.95,
        ),
        KnowledgeEdge(
            source="concept:zanzibar_acl",
            target="project:alpha",
            relation="implements",
            confidence=1.0,
        ),
        KnowledgeEdge(
            source="person:bob",
            target="decision:approval_gates",
            relation="proposed",
            confidence=1.0,
        ),
        KnowledgeEdge(
            source="decision:approval_gates",
            target="project:alpha",
            relation="applies_to",
            confidence=0.9,
        ),
        KnowledgeEdge(
            source="person:charlie",
            target="concept:data_sovereignty",
            relation="authored",
            confidence=0.85,
        ),
    ]

    for edge in edges:
        graph.add_edge(edge)

    stats = graph.get_stats()
    print(f"Graph seeded: {stats['total_nodes']} nodes, {stats['total_edges']} edges")
    print(f"Node types: {stats['node_types']}")
    print(f"Graph stored at: {stats['graph_path']}")


if __name__ == "__main__":
    asyncio.run(seed_graph())
