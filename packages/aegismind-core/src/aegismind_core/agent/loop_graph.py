from __future__ import annotations

import logging
from typing import Any

from aegismind_graph.engine import KnowledgeGraphEngine

logger = logging.getLogger(__name__)


class GraphAwareAgentMixin:
    """Mixin that adds knowledge graph context to the sovereign agent loop."""

    def __init__(
        self, graph_engine: KnowledgeGraphEngine | None = None, *args: Any, **kwargs: Any
    ) -> None:
        super().__init__(*args, **kwargs)
        self.graph_engine = graph_engine

    def enrich_prompt_with_graph(self, prompt: str) -> str:
        """Query the graph for relevant entities and inject context into the prompt."""
        if self.graph_engine is None:
            return prompt

        try:
            # Extract entities from the current prompt
            entities = self.graph_engine.extract_entities(prompt)

            # Build graph context string
            context_parts = ["\n\n=== KNOWLEDGE GRAPH CONTEXT ==="]

            if entities:
                context_parts.append("Recently mentioned entities:")
                for entity in entities[:5]:
                    context_parts.append(f"  - {entity.entity_type}: {entity.name}")
                    # Add connections
                    node = self.graph_engine.get_node(entity.id)
                    if node and node.connections:
                        raw_connections = [
                            self.graph_engine.get_node(cid) for cid in node.connections[:3]
                        ]
                        connections = [c for c in raw_connections if c is not None]
                        if connections:
                            conn_names = [c.name for c in connections]
                            context_parts.append(f"    Connected to: {', '.join(conn_names)}")

            # Query graph for related context
            related = self.graph_engine.query(query=prompt, limit=10)
            if related.nodes:
                context_parts.append("\nRelated graph entities:")
                for node in related.nodes[:5]:
                    context_parts.append(f"  - [{node.entity_type}] {node.name}")
                    if node.connections:
                        context_parts.append(f"    Links to {len(node.connections)} entities")

            context_parts.append("=== END GRAPH CONTEXT ===\n")
            return prompt + "\n".join(context_parts)
        except Exception as exc:
            logger.warning("Graph enrichment failed: %s", exc)
            return prompt

    async def run_with_graph(self, prompt: str, **kwargs: Any) -> Any:
        """Run the agent loop with graph-enriched prompt."""
        enriched_prompt = self.enrich_prompt_with_graph(prompt)
        run_fn = getattr(self, "run", None)
        if callable(run_fn):
            return await run_fn(prompt=enriched_prompt, **kwargs)
        raise NotImplementedError("Underlying agent class does not implement run()")
