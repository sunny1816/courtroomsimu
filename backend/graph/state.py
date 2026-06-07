from typing import Any, TypedDict


class LEXAState(TypedDict, total=False):
    case_id: str
    case_text: str
    evidence: dict[str, Any]
    retrieved_laws: list[dict[str, Any]]
    prosecution: str
    defense: str
    contradictions: list[dict[str, str]]
    judge_reasoning: str
    jury_vote: dict[str, Any]
    final_verdict: str
    appeal_decision: str
    agent_trace: list[dict[str, Any]]
