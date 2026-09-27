from __future__ import annotations

from datetime import UTC, datetime
from enum import StrEnum
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class ApprovalStatus(StrEnum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    EXPIRED = "expired"


class ActionProposal(BaseModel):
    """A proposed action awaiting human approval before execution."""

    model_config = ConfigDict(frozen=False)

    id: str = Field(default_factory=lambda: f"app_{datetime.now(UTC).strftime('%Y%m%d_%H%M%S')}")
    tool_name: str = Field(..., description="Name of the tool to be executed")
    arguments: dict[str, Any] = Field(default_factory=dict, description="Tool arguments")
    reasoning: str = Field(default="", description="Why the agent wants to execute this")
    risk_level: str = Field(default="read", description="read, write, execute, dangerous")
    proposed_by: str = Field(default="local_agent", description="Agent that proposed this")
    status: ApprovalStatus = Field(default=ApprovalStatus.PENDING)
    created_at: str = Field(default_factory=lambda: datetime.now(UTC).isoformat())
    reviewed_by: str | None = Field(default=None, description="Who approved/rejected")
    review_reason: str | None = Field(default=None, description="Reason for approval/rejection")
    reviewed_at: str | None = Field(default=None)


class ApprovalDecision(BaseModel):
    """A decision to approve or reject a proposed action."""

    model_config = ConfigDict(frozen=True)

    proposal_id: str = Field(..., description="ID of the proposal to decide on")
    approved: bool = Field(..., description="True if approved, False if rejected")
    reason: str = Field(default="", description="Why this decision was made")
    reviewed_by: str = Field(default="user", description="Who made this decision")


class PendingAction(BaseModel):
    """Summary of an action waiting for approval."""

    model_config = ConfigDict(frozen=True)

    proposal: ActionProposal
    wait_seconds: int = Field(default=0, description="Seconds since proposal was created")
    summary: str = Field(default="", description="Human-readable summary")
