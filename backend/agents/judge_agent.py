from graph.state import LEXAState
from services.nim_client import call_agent


def judge_agent(state: LEXAState) -> dict:
    output = call_agent(
        "Weigh arguments impartially. Apply cited laws and explain your reasoning.",
        str({key: state.get(key) for key in ("evidence", "retrieved_laws", "prosecution", "defense", "contradictions")}),
    )
    return {"judge_reasoning": output, "agent_trace": state.get("agent_trace", []) + [{"agent": "Judge", "output": output}]}
