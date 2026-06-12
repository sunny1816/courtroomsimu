import re
from typing import Any

from graph.state import LEXAState
from services.nim_client import call_agent
from services.json_utils import parse_json

INNOCENCE_TERMS = {
    "alibi",
    "flight records",
    "hotel records",
    "attendance records",
    "cctv elsewhere",
    "different location",
    "not present",
    "could not have",
    "proved innocence",
    "innocent",
    "mistaken identity",
    "wrong person",
    "not involved",
    "not at the scene",
    "another suspect",
    "elsewhere",
}

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
            "judge": state.get("judge_reasoning", ""),
        }
    ).lower()

    support = _count_positive(combined, SUPPORT_TERMS)
    doubt = _count(combined, DOUBT_TERMS)
    corroboration = _count_positive(combined, CORROBORATION_TERMS)

    INNOCENCE_TERMS = {
        "alibi",
        "flight records",
        "hotel records",
        "attendance records",
        "cctv elsewhere",
        "different location",
        "not present",
        "could not have",
        "proved innocence",
        "innocent",
        "mistaken identity",
        "wrong person",
        "not involved",
        "not at the scene",
        "another suspect",
        "elsewhere",
    }

    innocence = _count_positive(combined, INNOCENCE_TERMS)

    severe = any(
        term in combined
        for term in (
            "death",
            "died",
            "killed",
            "murder",
            "assault",
            "bodily injury",
        )
    )

    short_record = len(state.get("case_text", "").split()) < 15

    judge_reasoning = state.get("judge_reasoning", "").lower()

    # --------------------------------------------------
    # PRIMARY VERDICT LOGIC
    # --------------------------------------------------

    if innocence >= 2:
        verdict = "Not Guilty"

    elif "beyond reasonable doubt" in judge_reasoning:
        verdict = "Guilty"

    elif "reasonable doubt" in judge_reasoning:
        verdict = "Not Guilty"

    elif "insufficient evidence" in judge_reasoning:
        verdict = "Insufficient Evidence"

    elif short_record:
        verdict = "Insufficient Evidence"

    elif support >= doubt + 2 and corroboration >= 2:
        verdict = "Guilty"

    elif severe and support > doubt and corroboration >= 2:
        verdict = "Guilty"

    elif doubt >= support:
        verdict = "Not Guilty"

    else:
        verdict = "Insufficient Evidence"

    # --------------------------------------------------
    # CONFIDENCE + JURY VOTES
    # --------------------------------------------------

    gap = abs((support + innocence) - doubt)

    if verdict == "Guilty":
        confidence = min(
            0.95,
            max(
                0.65,
                0.65
                + gap * 0.04
                + corroboration * 0.03
                - doubt * 0.01,
            ),
        )

        votes = {
            "guilty": 5 if confidence >= 0.80 else 4,
            "not_guilty": 0 if confidence >= 0.80 else 1,
            "abstain": 0,
        }

    elif verdict == "Not Guilty":
        confidence = min(
            0.95,
            max(
                0.65,
                0.65
                + innocence * 0.05
                + max(doubt - support, 0) * 0.03,
            ),
        )

        votes = {
            "guilty": 0,
            "not_guilty": 5 if confidence >= 0.80 else 4,
            "abstain": 0 if confidence >= 0.80 else 1,
        }

    else:
        confidence = min(
            0.70,
            max(
                0.50,
                0.52 + gap * 0.02,
            ),
        )

        votes = {
            "guilty": 0,
            "not_guilty": 0,
            "abstain": 5,
        }

    return {
        "verdict": verdict,
        "confidence": round(confidence, 2),
        "votes": votes,
    }


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
