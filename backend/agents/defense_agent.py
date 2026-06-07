from graph.state import LEXAState
from services.nim_client import call_agent


def defense_agent(state: LEXAState) -> dict:
    output = call_agent(
        "You are defense counsel. Challenge every prosecution claim and identify reasonable doubt.",
        f"Evidence: {state.get('evidence')}\nProsecution: {state.get('prosecution')}",
    )
    return {"defense": output, "agent_trace": state.get("agent_trace", []) + [{"agent": "Defense", "output": output}]}
