from graph.state import LEXAState
from services.nim_client import call_agent
from services.json_utils import parse_json


def evidence_agent(state: LEXAState) -> dict:
    content = call_agent(
        "Extract facts, persons, dates, and events from the case text. Return compact JSON only.",
        state["case_text"],
    )
    evidence = parse_json(content, {"facts": [content], "people": [], "dates": [], "events": []})
    return {"evidence": evidence, "agent_trace": state.get("agent_trace", []) + [{"agent": "Evidence", "output": evidence}]}
