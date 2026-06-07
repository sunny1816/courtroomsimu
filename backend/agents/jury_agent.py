import re
from typing import Any

from graph.state import LEXAState
from services.nim_client import call_agent
from services.json_utils import parse_json


SUPPORT_TERMS = {
    "witness says",
    "witnesses",
    "identified",
    "struck",
    "assault",
    "assaulting",
    "killed",
    "death",
    "died",
    "bodily injury",
    "weapon",
    "rod",
    "knife",
    "recovered",
    "forensic match",
    "medical report",
    "cctv shows",
    "confession",
    "motive",
    "threatened",
}

DOUBT_TERMS = {
    "inconclusive",
    "disputed",
    "contradict",
    "could not",
    "cannot",
    "unclear",
    "not clearly",
    "no witness",
    "no forensic",
    "unavailable",
    "alibi",
    "hearsay",
    "far away",
    "unreliable",
    "insufficient",
}

CORROBORATION_TERMS = {
    "witness",
    "medical",
    "forensic",
    "recovered",
    "cctv",
    "confession",
    "document",
    "report",
    "weapon",
}


def _text(value: Any) -> str:
    if isinstance(value, str):
        return value
    if isinstance(value, dict):
        return " ".join(_text(item) for item in value.values())
    if isinstance(value, list):
        return " ".join(_text(item) for item in value)
    return str(value or "")


def _count(text: str, terms: set[str]) -> int:
    return sum(1 for term in terms if re.search(rf"\b{re.escape(term)}\b", text))


def _count_positive(text: str, terms: set[str]) -> int:
    total = 0
    for term in terms:
        for match in re.finditer(rf"\b{re.escape(term)}\b", text):
            prefix = text[max(0, match.start() - 35) : match.start()]
            suffix = text[match.end() : match.end() + 25]
            if re.search(r"\b(no|not|without|missing|absent|incomplete)\b", prefix):
                continue
            if re.search(r"\b(unavailable|incomplete|inconclusive|disputed)\b", suffix):
                continue
            total += 1
            break
    return total


def _normalize_vote(state: LEXAState, vote: dict[str, Any]) -> dict[str, Any]:
    combined = _text(
        {
            "case": state.get("case_text", ""),
            "evidence": state.get("evidence", {}),
        }
    ).lower()
    support = _count_positive(combined, SUPPORT_TERMS)
    doubt = _count(combined, DOUBT_TERMS)
    corroboration = _count_positive(combined, CORROBORATION_TERMS)
    severe = any(term in combined for term in ("death", "died", "killed", "murder", "assault", "bodily injury"))
    short_record = len(state.get("case_text", "").split()) < 15

    verdict = str(vote.get("verdict") or "").strip()
    if short_record or support <= 1:
        verdict = "Insufficient Evidence"
    elif support >= doubt + 2 and corroboration >= 2:
        verdict = "Guilty"
    elif severe and support > doubt and corroboration >= 2:
        verdict = "Guilty"
    elif doubt >= support and corroboration < 3:
        verdict = "Not Guilty"
    elif verdict not in {"Guilty", "Not Guilty", "Insufficient Evidence"} or verdict == "Insufficient Evidence":
        verdict = "Not Guilty" if doubt > support else "Insufficient Evidence"

    gap = abs(support - doubt)
    if verdict == "Guilty":
        confidence = min(0.9, max(0.58, 0.58 + gap * 0.04 + corroboration * 0.025 - doubt * 0.01))
        votes = {"guilty": 4 if confidence >= 0.68 else 3, "not_guilty": 1, "abstain": 0 if confidence >= 0.68 else 1}
    elif verdict == "Not Guilty":
        confidence = min(0.86, max(0.56, 0.56 + max(doubt - support, 0) * 0.05 + max(3 - corroboration, 0) * 0.03))
        votes = {"guilty": 1, "not_guilty": 4 if confidence >= 0.66 else 3, "abstain": 0 if confidence >= 0.66 else 1}
    else:
        confidence = min(0.66, max(0.5, 0.52 + gap * 0.025))
        votes = {"guilty": 1 if support > doubt else 0, "not_guilty": 1 if doubt > support else 0, "abstain": 4}

    return {"verdict": verdict, "confidence": round(confidence, 2), "votes": votes}


def jury_agent(state: LEXAState) -> dict:
    content = call_agent(
        "Vote independently. Assign confidence 0-1. Return JSON with verdict, confidence, and votes.",
        f"Judge reasoning: {state.get('judge_reasoning')}\nContradictions: {state.get('contradictions')}",
    )
    vote = parse_json(content, {"verdict": "", "confidence": 0.5, "votes": {"guilty": 0, "not_guilty": 0, "abstain": 5}})
    vote = _normalize_vote(state, vote if isinstance(vote, dict) else {})
    return {
        "jury_vote": vote,
        "final_verdict": vote.get("verdict", "Insufficient Evidence"),
        "agent_trace": state.get("agent_trace", []) + [{"agent": "Jury", "output": vote}],
    }
