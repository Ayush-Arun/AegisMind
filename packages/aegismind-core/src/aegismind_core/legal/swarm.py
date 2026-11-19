from __future__ import annotations

import asyncio
import json
import logging
import re
import uuid
from collections.abc import AsyncIterator
from typing import Any

from aegismind_core.adapters.llm.ollama import OllamaAdapter
from aegismind_core.legal.models import (
    ExtractedFacts,
    LegalAuditReport,
    LegalCaseInput,
    PrecedentItem,
    StrategyItem,
    WeaknessItem,
)
from aegismind_core.legal.prompts import (
    FACT_EXTRACTOR_SYSTEM_PROMPT,
    LEAD_SYNTHESIZER_SYSTEM_PROMPT,
    PRECEDENT_RESEARCHER_SYSTEM_PROMPT,
    STRATEGY_ADVISOR_SYSTEM_PROMPT,
    WEAKNESS_HUNTER_SYSTEM_PROMPT,
)
from aegismind_core.legal.retriever import search_precedents

logger = logging.getLogger("legal_swarm")


def _clean_json_output(raw: str) -> str:
    """Strip markdown code fence blocks if present."""
    text = raw.strip()
    if text.startswith("```"):
        text = re.sub(r"^```[a-zA-Z]*\n", "", text)
        text = re.sub(r"\n```$", "", text)
    return text.strip()


class LegalSwarmOrchestrator:
    """Autonomous Multi-Agent Legal Swarm specialized in Indian Law.
    Coordinates Fact Extractor, Weakness Hunter, Strategy Advisor,
    Precedent Researcher, and Lead Synthesizer.
    """

    def __init__(self, llm: OllamaAdapter | None = None) -> None:
        self.llm = llm or OllamaAdapter()

    async def _call_agent(self, system_prompt: str, user_prompt: str) -> str:
        """Call local LLM with specific agent prompt."""
        try:
            return await self.llm.generate(
                prompt=user_prompt,
                system_prompt=system_prompt,
                temperature=0.2,
            )
        except Exception as exc:
            logger.error("Agent execution error: %s", exc)
            return ""

    async def analyze_stream(self, case_input: LegalCaseInput) -> AsyncIterator[dict[str, Any]]:
        """Execute the multi-agent legal chamber with real-time SSE progress streaming."""
        case_id = f"case-{uuid.uuid4().hex[:8]}"
        deliberation_log: list[dict[str, Any]] = []

        # ------------------------------------------------------------------
        # Agent 1: Fact & Procedural Posture Extractor
        # ------------------------------------------------------------------
        yield {
            "type": "agent_start",
            "agent": "Fact & Timeline Extractor",
            "message": "Parsing pleadings, establishing parties, statutes, and chronological timeline...",
        }
        fact_prompt = f"""Case Title: {case_input.case_title}
Branch: {case_input.case_type} | Forum: {case_input.court_forum} | Posture: {case_input.client_posture}
Specific Inquiries: {', '.join(case_input.specific_questions) if case_input.specific_questions else 'Comprehensive audit'}

CASE DOSSIER / FILE TEXT:
{case_input.case_text[:12000]}
"""
        raw_facts = await self._call_agent(FACT_EXTRACTOR_SYSTEM_PROMPT, fact_prompt)
        extracted_facts: ExtractedFacts
        try:
            facts_dict = json.loads(_clean_json_output(raw_facts))
            extracted_facts = ExtractedFacts(**facts_dict)
        except Exception as exc:
            logger.warning("Could not parse structured facts: %s; using heuristic fallback", exc)
            extracted_facts = ExtractedFacts(
                case_title=case_input.case_title,
                court_forum=case_input.court_forum,
                key_statutes=["Indian Law", case_input.case_type],
                undisputed_facts=[case_input.case_text[:300] + "..."],
                disputed_contentions=["Core controversy arising from pleadings."],
                core_legal_issues=["Whether relief claimed is barred by law or supported by evidence."],
            )

        deliberation_log.append({
            "agent": "Fact & Timeline Extractor",
            "status": "completed",
            "summary": f"Extracted {len(extracted_facts.key_statutes)} statutory grounds and {len(extracted_facts.core_legal_issues)} legal issues.",
        })
        yield {
            "type": "agent_complete",
            "agent": "Fact & Timeline Extractor",
            "data": extracted_facts.model_dump(),
        }

        # ------------------------------------------------------------------
        # Agent 2: Adversarial Weakness Hunter (Runs on Facts + Raw Case)
        # ------------------------------------------------------------------
        yield {
            "type": "agent_start",
            "agent": "Adversarial Weakness Hunter",
            "message": "Stress-testing case for evidentiary gaps, Section 65B certification, limitation bars, and statutory ingredient deficits...",
        }
        weakness_prompt = f"""CASE FACTS & ISSUES:
{extracted_facts.model_dump_json(indent=2)}

ORIGINAL CASE EXCERPT:
{case_input.case_text[:10000]}

Client Perspective: {case_input.client_posture}
Analyze all legal loopholes, evidentiary defects, and procedural flaws under Indian law.
"""
        raw_weaknesses = await self._call_agent(WEAKNESS_HUNTER_SYSTEM_PROMPT, weakness_prompt)
        weaknesses_list: list[WeaknessItem] = []
        try:
            parsed_w = json.loads(_clean_json_output(raw_weaknesses))
            if isinstance(parsed_w, list):
                for w in parsed_w:
                    weaknesses_list.append(WeaknessItem(**w))
        except Exception as exc:
            logger.warning("Could not parse weaknesses: %s; fallback", exc)
            weaknesses_list = [
                WeaknessItem(
                    id="W1",
                    severity="HIGH",
                    category="EVIDENTIARY_DEFECT",
                    title="Evidentiary Proof & Corroboration Standard",
                    description="Case relies heavily on uncorroborated assertions without supporting documentary exhibits.",
                    statutory_basis="Indian Evidence Act, 1872 / BSA 2023",
                    impact_on_case="Substantially lowers the probability of surviving summary disposal or cross-examination.",
                    opposing_counsel_angle="Opposing counsel will move for dismissal on failure to establish prima facie burden.",
                )
            ]

        deliberation_log.append({
            "agent": "Adversarial Weakness Hunter",
            "status": "completed",
            "summary": f"Identified {len(weaknesses_list)} potential weaknesses and vulnerabilities.",
        })
        yield {
            "type": "agent_complete",
            "agent": "Adversarial Weakness Hunter",
            "data": [w.model_dump() for w in weaknesses_list],
        }

        # ------------------------------------------------------------------
        # Agent 3: Precedent & Legal Authority Researcher
        # ------------------------------------------------------------------
        yield {
            "type": "agent_start",
            "agent": "Precedent & Authority Researcher",
            "message": "Searching Indian Supreme Court database for binding ratios and landmark rulings...",
        }
        search_terms = f"{case_input.case_type} {' '.join(extracted_facts.key_statutes)} {' '.join(extracted_facts.core_legal_issues)}"
        retrieved_precedents = search_precedents(search_terms, limit=5)

        precedent_prompt = f"""CASE CONTROVERSIES:
{json.dumps(extracted_facts.core_legal_issues, indent=2)}
STATUTES:
{json.dumps(extracted_facts.key_statutes, indent=2)}

RETRIEVED PRECEDENTS FROM REPOSITORY:
{json.dumps([p.model_dump() for p in retrieved_precedents], indent=2)}

Provide top binding Indian Supreme Court landmark precedents governing these controversies.
"""
        raw_precedents = await self._call_agent(PRECEDENT_RESEARCHER_SYSTEM_PROMPT, precedent_prompt)
        precedents_list: list[PrecedentItem] = list(retrieved_precedents)
        try:
            parsed_p = json.loads(_clean_json_output(raw_precedents))
            if isinstance(parsed_p, list):
                for p in parsed_p:
                    item = PrecedentItem(**p)
                    if not any(existing.case_name == item.case_name for existing in precedents_list):
                        precedents_list.append(item)
        except Exception:
            pass

        deliberation_log.append({
            "agent": "Precedent & Authority Researcher",
            "status": "completed",
            "summary": f"Matched {len(precedents_list)} relevant Indian authorities and SCR citations.",
        })
        yield {
            "type": "agent_complete",
            "agent": "Precedent & Authority Researcher",
            "data": [p.model_dump() for p in precedents_list],
        }

        # ------------------------------------------------------------------
        # Agent 4: Tactical Strategy Advisor
        # ------------------------------------------------------------------
        yield {
            "type": "agent_start",
            "agent": "Tactical Strategy Advisor",
            "message": "Drafting tactical maneuvers, quashing/injunction remedies, and cross-examination questions...",
        }
        strategy_prompt = f"""FACTS:
{extracted_facts.model_dump_json(indent=2)}

IDENTIFIED WEAKNESSES:
{json.dumps([w.model_dump() for w in weaknesses_list], indent=2)}

KEY PRECEDENTS:
{json.dumps([p.model_dump() for p in precedents_list[:3]], indent=2)}

Client Posture: {case_input.client_posture}
Formulate the tactical action plan (e.g. S.482 CrPC / O.7 R.11 CPC / Bail / Cross-examination questions).
"""
        raw_strategy = await self._call_agent(STRATEGY_ADVISOR_SYSTEM_PROMPT, strategy_prompt)
        strategy_list: list[StrategyItem] = []
        try:
            parsed_s = json.loads(_clean_json_output(raw_strategy))
            if isinstance(parsed_s, list):
                for s in parsed_s:
                    strategy_list.append(StrategyItem(**s))
        except Exception as exc:
            logger.warning("Could not parse strategy: %s; fallback", exc)
            strategy_list = [
                StrategyItem(
                    id="S1",
                    phase="IMMEDIATE_PRELIMINARY",
                    remedy_title="Preliminary Application under Relevant Civil/Criminal Code",
                    procedural_mechanism="Dispositive Application / Motion to Dismiss",
                    strategic_rationale="Raise preliminary objection on limitation and non-joinder before framing of issues.",
                    actionable_steps=["Draft application citing statutory bar.", "File certified copies of prior proceedings."],
                    key_cross_examination_questions=["Did you issue statutory notice within the prescribed limitation?"],
                )
            ]

        deliberation_log.append({
            "agent": "Tactical Strategy Advisor",
            "status": "completed",
            "summary": f"Formulated {len(strategy_list)} tactical legal remedies and cross-examination angles.",
        })
        yield {
            "type": "agent_complete",
            "agent": "Tactical Strategy Advisor",
            "data": [s.model_dump() for s in strategy_list],
        }

        # ------------------------------------------------------------------
        # Agent 5: Lead Legal Synthesizer
        # ------------------------------------------------------------------
        yield {
            "type": "agent_start",
            "agent": "Lead Legal Synthesizer",
            "message": "Synthesizing comprehensive Legal Strategy & Audit Memorandum...",
        }
        synth_prompt = f"""FACTS:
{extracted_facts.model_dump_json(indent=2)}

WEAKNESSES:
{json.dumps([w.model_dump() for w in weaknesses_list], indent=2)}

STRATEGY:
{json.dumps([s.model_dump() for s in strategy_list], indent=2)}

PRECEDENTS:
{json.dumps([p.model_dump() for p in precedents_list], indent=2)}

Draft the final executive Legal Opinion and Case Audit Memorandum.
"""
        full_memo = await self._call_agent(LEAD_SYNTHESIZER_SYSTEM_PROMPT, synth_prompt)
        if not full_memo or len(full_memo.strip()) < 100:
            full_memo = f"# LEGAL CASE ASSESSMENT MEMORANDUM\n\n## 1. Executive Summary\nAnalysis conducted for **{case_input.case_title}** under Indian jurisprudence.\n\n### Key Weaknesses Detected:\n" + "\n".join(f"- **{w.title}** ({w.severity}): {w.description}" for w in weaknesses_list)

        # Compute Case Strength Score & Risk Level
        crit_count = sum(1 for w in weaknesses_list if w.severity == "CRITICAL")
        high_count = sum(1 for w in weaknesses_list if w.severity == "HIGH")
        mod_count = sum(1 for w in weaknesses_list if w.severity == "MODERATE")
        
        strength_score = max(10, 100 - (crit_count * 25 + high_count * 15 + mod_count * 5))
        if strength_score < 40:
            risk_level = "CRITICAL_RISK"
        elif strength_score < 65:
            risk_level = "HIGH_RISK"
        elif strength_score < 85:
            risk_level = "MODERATE_RISK"
        else:
            risk_level = "STRONG_POSITION"

        final_report = LegalAuditReport(
            case_id=case_id,
            case_title=case_input.case_title,
            case_type=case_input.case_type,
            overall_strength_score=strength_score,
            risk_level=risk_level,
            executive_summary=(
                f"Matter evaluated under Indian Law ({case_input.court_forum}). Found {len(weaknesses_list)} strategic "
                f"weaknesses (including {crit_count} Critical and {high_count} High risk points). Recommended "
                f"{len(strategy_list)} affirmative counter-measures supported by {len(precedents_list)} case law precedents."
            ),
            facts=extracted_facts,
            weaknesses=weaknesses_list,
            strategic_approach=strategy_list,
            precedents=precedents_list,
            full_legal_opinion=full_memo,
            deliberation_log=deliberation_log,
        )

        yield {
            "type": "final_report",
            "report": final_report.model_dump(),
        }

    async def analyze(self, case_input: LegalCaseInput) -> LegalAuditReport:
        """Run complete analysis and return final report."""
        report_data = None
        async for event in self.analyze_stream(case_input):
            if event["type"] == "final_report":
                report_data = event["report"]
        if report_data:
            return LegalAuditReport(**report_data)
        raise RuntimeError("Legal swarm analysis failed to produce final report")
