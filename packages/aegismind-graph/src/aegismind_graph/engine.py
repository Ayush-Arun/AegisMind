from __future__ import annotations

import logging
import json
from collections.abc import Callable
from datetime import datetime, UTC
from typing import Any

from aegismind_graph.models import KnowledgeEdge, KnowledgeNode, GraphQueryResult

logger = logging.getLogger(__name__)


class KnowledgeGraphEngine:
    """Persistent knowledge graph for the sovereign second brain.

    Stores entities (people, projects, concepts, decisions) and their relationships.
    Supports entity extraction, relationship linking, and contextual graph queries.
    All data persists to a local JSON file for sovereignty.
    """

    def __init__(
        self,
        graph_path: str = "./storage/graph/graph.json",
        on_node_change: Callable[..., Any] | None = None,
        on_edge_change: Callable[..., Any] | None = None,
    ) -> None:
        self._graph_path = graph_path
        self._on_node_change = on_node_change
        self._on_edge_change = on_edge_change
        self._nodes: dict[str, KnowledgeNode] = {}
        self._edges: list[KnowledgeEdge] = []
        self._load()

    def _load(self) -> None:
        """Load graph from persistent storage."""
        import json
        from pathlib import Path

        path = Path(self._graph_path)
        if not path.exists():
            path.parent.mkdir(parents=True, exist_ok=True)
            self._save()
            return

        try:
            data = json.loads(path.read_text(encoding="utf-8"))
            self._nodes = {
                nid: KnowledgeNode.model_validate(n)
                for nid, n in data.get("nodes", {}).items()
            }
            self._edges = [
                KnowledgeEdge.model_validate(e) for e in data.get("edges", [])
            ]
            logger.info("Loaded knowledge graph: %d nodes, %d edges", len(self._nodes), len(self._edges))
        except Exception as exc:
            logger.warning("Failed loading graph: %s", exc)
            self._nodes = {}
            self._edges = []

    def _save(self) -> None:
        """Persist graph to local JSON storage."""
        import json
        from pathlib import Path

        path = Path(self._graph_path)
        path.parent.mkdir(parents=True, exist_ok=True)
        data = {
            "nodes": {nid: n.model_dump() for nid, n in self._nodes.items()},
            "edges": [e.model_dump() for e in self._edges],
            "metadata": {
                "version": "1.0",
                "last_updated": datetime.now(UTC).isoformat(),
                "node_count": len(self._nodes),
                "edge_count": len(self._edges),
            },
        }
        path.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")

    def add_node(self, node: KnowledgeNode) -> KnowledgeNode:
        """Add or update a node in the graph."""
        self._nodes[node.id] = node
        self._save()
        if self._on_node_change:
            self._on_node_change("add", node)
        return node

    def get_node(self, node_id: str) -> KnowledgeNode | None:
        """Retrieve a node by ID."""
        return self._nodes.get(node_id)

    def get_nodes_by_type(self, entity_type: str) -> list[KnowledgeNode]:
        """Get all nodes of a given entity type."""
        return [n for n in self._nodes.values() if n.entity_type == entity_type]

    def get_node_by_name(self, name: str) -> KnowledgeNode | None:
        """Find a node by name (case-insensitive partial match)."""
        for node in self._nodes.values():
            if name.lower() in node.name.lower():
                return node
        return None

    def add_edge(self, edge: KnowledgeEdge) -> KnowledgeEdge:
        """Add a directed edge between two nodes. Creates nodes if they don't exist."""
        if edge.source not in self._nodes:
            self.add_node(
                KnowledgeNode(id=edge.source, entity_type="concept", name=edge.source)
            )
        if edge.target not in self._nodes:
            self.add_node(
                KnowledgeNode(id=edge.target, entity_type="concept", name=edge.target)
            )

        self._edges.append(edge)

        # Update connection lists
        if edge.target not in self._nodes[edge.source].connections:
            self._nodes[edge.source].connections.append(edge.target)
        if edge.source not in self._nodes[edge.target].connections:
            self._nodes[edge.target].connections.append(edge.source)

        self._save()
        if self._on_edge_change:
            self._on_edge_change("add", edge)
        return edge

    def get_edges_for_node(self, node_id: str) -> list[KnowledgeEdge]:
        """Get all edges connected to a node."""
        return [e for e in self._edges if e.source == node_id or e.target == node_id]

    def query(
        self,
        query: str | None = None,
        entity_type: str | None = None,
        relation: str | None = None,
        node_id: str | None = None,
        limit: int = 20,
    ) -> GraphQueryResult:
        """Query the graph with filters.

        Supports searching by:
        - query: text search across node names
        - entity_type: filter by node type
        - relation: filter by edge relation type
        - node_id: get subgraph around a specific node
        - limit: max results
        """
        nodes: list[KnowledgeNode] = []
        edges: list[KnowledgeEdge] = []
        paths: list[list[str]] = []

        if node_id and node_id in self._nodes:
            # BFS around the node
            visited: set[str] = {node_id}
            queue = [node_id]
            depth = 0
            while queue and depth < 3:
                next_queue = []
                for nid in queue:
                    for edge in self._edges:
                        neighbor = None
                        if edge.source == nid and edge.target not in visited:
                            neighbor = edge.target
                        elif edge.target == nid and edge.source not in visited:
                            neighbor = edge.source
                        if neighbor:
                            visited.add(neighbor)
                            next_queue.append(neighbor)
                            if len(nodes) < limit:
                                nodes.append(self._nodes[neighbor])
                                edges.append(edge)
                queue = next_queue
                depth += 1
            paths = [[node_id]]
        elif query or entity_type:
            for node in self._nodes.values():
                match = False
                if query and query.lower() in node.name.lower():
                    match = True
                if entity_type and node.entity_type == entity_type:
                    match = True
                if match and len(nodes) < limit:
                    nodes.append(node)
                    for edge in self._edges:
                        if edge.source == node.id or edge.target == node.id:
                            if relation is None or edge.relation == relation:
                                edges.append(edge)
        else:
            nodes = list(self._nodes.values())[:limit]

        return GraphQueryResult(
            nodes=nodes[:limit],
            edges=edges[:limit],
            total_count=len(nodes),
        )

    def extract_entities(self, text: str) -> list[KnowledgeNode]:
        """Extract potential entities from text using heuristic patterns.

        Detects: project names, person names, decision keywords, dates.
        """
        import re

        entities: list[KnowledgeNode] = []

        # Detect project references
        project_patterns = re.findall(r"(?:project|initiative|program)\s+[A-Z][a-zA-Z0-9_-]+", text, re.IGNORECASE)
        for proj in project_patterns:
            node_id = f"project:{proj.lower().replace(' ', '_')}"
            if node_id not in self._nodes:
                entities.append(
                    KnowledgeNode(
                        id=node_id,
                        entity_type="project",
                        name=proj,
                        properties={"detected_from": text[:200]},
                        source_query=text[:200],
                    )
                )

        # Detect person references (@mentions or "person" patterns)
        person_patterns = re.findall(r"@(\w+)", text)
        for person in person_patterns:
            node_id = f"person:{person.lower()}"
            if node_id not in self._nodes:
                entities.append(
                    KnowledgeNode(
                        id=node_id,
                        entity_type="person",
                        name=person,
                        properties={"detected_from": text[:200]},
                        source_query=text[:200],
                    )
                )

        # Detect decision references
        decision_patterns = re.findall(r"(?:decided|decision|approved|rejected)\s+['\"]?([^'\"]+?)['\"]?", text, re.IGNORECASE)
        for decision in decision_patterns:
            node_id = f"decision:{decision.lower().replace(' ', '_')[:40]}"
            if node_id not in self._nodes:
                entities.append(
                    KnowledgeNode(
                        id=node_id,
                        entity_type="decision",
                        name=f"Decision: {decision}",
                        properties={"detected_from": text[:200]},
                        source_query=text[:200],
                    )
                )

        return entities

    def get_stats(self) -> dict[str, Any]:
        """Return graph statistics."""
        type_counts: dict[str, int] = {}
        for node in self._nodes.values():
            type_counts[node.entity_type] = type_counts.get(node.entity_type, 0) + 1
        return {
            "total_nodes": len(self._nodes),
            "total_edges": len(self._edges),
            "node_types": type_counts,
            "graph_path": self._graph_path,
        }
