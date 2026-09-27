from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, UTC
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class KnowledgeNode(BaseModel):
    """Represents an entity in the sovereign knowledge graph."""

    model_config = ConfigDict(frozen=True)

    id: str = Field(..., description="Unique node identifier")
    entity_type: str = Field(..., description="Entity type: person, project, concept, decision, tool")
    name: str = Field(..., description="Human-readable name")
    properties: dict[str, Any] = Field(default_factory=dict, description="Flexible entity attributes")
    connections: list[str] = Field(default_factory=list, description="IDs of connected nodes")
    created_at: str = Field(default_factory=lambda: datetime.now(UTC).isoformat())
    source_query: str | None = Field(default=None, description="Query that created this node")


class KnowledgeEdge(BaseModel):
    """Represents a directed relationship between two knowledge nodes."""

    model_config = ConfigDict(frozen=True)

    source: str = Field(..., description="Source node ID")
    target: str = Field(..., description="Target node ID")
    relation: str = Field(..., description="Relationship type: works_on, decided, authored, influenced, depends_on")
    confidence: float = Field(default=1.0, ge=0.0, le=1.0, description="Edge confidence score")
    timestamp: str = Field(default_factory=lambda: datetime.now(UTC).isoformat())
    properties: dict[str, Any] = Field(default_factory=dict, description="Edge metadata")


class GraphQueryResult(BaseModel):
    """Result of a graph traversal query."""

    model_config = ConfigDict(frozen=True)

    nodes: list[KnowledgeNode] = Field(default_factory=list)
    edges: list[KnowledgeEdge] = Field(default_factory=list)
    paths: list[list[str]] = Field(default_factory=list, description="Node ID paths found")
    total_count: int = Field(default=0)
