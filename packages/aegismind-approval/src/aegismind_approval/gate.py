from __future__ import annotations

import logging
import json
from datetime import datetime, UTC, timedelta
from typing import Any, Callable

from aegismind_approval.models import (
    ActionProposal,
    ApprovalDecision,
    ApprovalStatus,
    PendingAction,
)

logger = logging.getLogger(__name__)

DEFAULT_EXPIRY_SECONDS = 300  # 5 minutes


class ApprovalGate:
    """Human-in-the-loop approval gate for sovereign agent actions.

    Before any agent action with risk_level >= 'write' is executed,
    it is registered as a proposal and requires explicit human approval.
    This ensures controlled execution with full auditability.
    """

    def __init__(
        self,
        approval_log_path: str = "./storage/approval/approvals.json",
        expiry_seconds: int = DEFAULT_EXPIRY_SECONDS,
        on_approval_change: Callable[..., Any] | None = None,
    ) -> None:
        self._approval_log_path = approval_log_path
        self._expiry_seconds = expiry_seconds
        self._on_approval_change = on_approval_change
        self._proposals: dict[str, ActionProposal] = {}
        self._load()

    def _load(self) -> None:
        """Load pending approvals from persistent storage."""
        import json
        from pathlib import Path

        path = Path(self._approval_log_path)
        if not path.exists():
            path.parent.mkdir(parents=True, exist_ok=True)
            return

        try:
            data = json.loads(path.read_text(encoding="utf-8"))
            self._proposals = {
                pid: ActionProposal.model_validate(p)
                for pid, p in data.get("proposals", {}).items()
                if p.get("status") == ApprovalStatus.PENDING.value
            }
            logger.info("Loaded %d pending approval proposals", len(self._proposals))
        except Exception as exc:
            logger.warning("Failed loading approvals: %s", exc)
            self._proposals = {}

    def _save(self) -> None:
        """Persist approval proposals to local storage."""
        import json
        from pathlib import Path

        path = Path(self._approval_log_path)
        path.parent.mkdir(parents=True, exist_ok=True)
        data = {
            "proposals": {
                pid: p.model_dump() for pid, p in self._proposals.items()
            },
            "metadata": {
                "last_updated": datetime.now(UTC).isoformat(),
                "pending_count": len(self._proposals),
            },
        }
        path.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")

    def propose(
        self,
        tool_name: str,
        arguments: dict[str, Any],
        reasoning: str,
        risk_level: str = "read",
        proposed_by: str = "local_agent",
    ) -> ActionProposal:
        """Register a proposed action awaiting human approval."""
        proposal = ActionProposal(
            tool_name=tool_name,
            arguments=arguments,
            reasoning=reasoning,
            risk_level=risk_level,
            proposed_by=proposed_by,
        )
        self._proposals[proposal.id] = proposal
        self._save()

        if self._on_approval_change:
            self._on_approval_change("propose", proposal)

        logger.info("Proposed action %s: %s (risk=%s)", proposal.id, tool_name, risk_level)
        return proposal

    def decide(self, decision: ApprovalDecision) -> bool:
        """Approve or reject a proposed action."""
        proposal = self._proposals.get(decision.proposal_id)
        if not proposal:
            logger.warning("Proposal %s not found", decision.proposal_id)
            return False

        if decision.approved:
            proposal.status = ApprovalStatus.APPROVED
            proposal.reviewed_by = decision.reviewed_by
            proposal.review_reason = decision.reason
        else:
            proposal.status = ApprovalStatus.REJECTED
            proposal.reviewed_by = decision.reviewed_by
            proposal.review_reason = decision.reason

        proposal.reviewed_at = datetime.now(UTC).isoformat()
        self._save()

        if self._on_approval_change:
            self._on_approval_change("decide", proposal)

        logger.info("Action %s %s by %s", proposal.id, "approved" if decision.approved else "rejected", decision.reviewed_by)
        return decision.approved

    def get_pending(self) -> list[PendingAction]:
        """Get all actions awaiting approval."""
        now = datetime.now(UTC)
        pending: list[PendingAction] = []

        for proposal in self._proposals.values():
            if proposal.status != ApprovalStatus.PENDING:
                continue
            # Check expiry
            created = datetime.fromisoformat(proposal.created_at)
            wait = (now - created).total_seconds()
            if wait > self._expiry_seconds:
                proposal.status = ApprovalStatus.EXPIRED
                self._save()
                continue

            summary = self._generate_summary(proposal)
            pending.append(PendingAction(proposal=proposal, wait_seconds=int(wait), summary=summary))

        pending.sort(key=lambda p: p.wait_seconds, reverse=True)
        return pending

    def get_proposal(self, proposal_id: str) -> ActionProposal | None:
        """Retrieve a specific proposal by ID."""
        return self._proposals.get(proposal_id)

    def _generate_summary(self, proposal: ActionProposal) -> str:
        """Generate a human-readable summary of the proposed action."""
        args_str = ", ".join(f"{k}={v}" for k, v in proposal.arguments.items())
        return (
            f"[{proposal.risk_level.upper()}] Agent wants to run '{proposal.tool_name}' "
            f"with args: {args_str}. Reason: {proposal.reasoning}"
        )

    def get_stats(self) -> dict[str, Any]:
        """Return approval statistics."""
        return {
            "total_proposals": len(self._proposals),
            "pending": sum(1 for p in self._proposals.values() if p.status == ApprovalStatus.PENDING),
            "approved": sum(1 for p in self._proposals.values() if p.status == ApprovalStatus.APPROVED),
            "rejected": sum(1 for p in self._proposals.values() if p.status == ApprovalStatus.REJECTED),
        }
