from graph.state import LEXAState
from services.nim_client import call_agent
from services.json_utils import parse_json


def contradiction_agent(state: LEXAState) -> dict:
    content = call_agent(
        "Identify factual conflicts between these statements. Return a JSON list only.",
        f"Evidence: {state.get('evidence')}\nProsecution: {state.get('prosecution')}\nDefense: {state.get('defense')}",
    )
    contradictions = parse_json(content, [{"statement_a": "case record", "statement_b": "agent arguments", "conflict": content}])
    return {
        "contradictions": contradictions,
        "agent_trace": state.get("agent_trace", []) + [{"agent": "ContradictionDetector", "output": contradictions}],
    }
