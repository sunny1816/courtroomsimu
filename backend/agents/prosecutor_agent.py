from graph.state import LEXAState
from services.nim_client import call_agent


def prosecutor_agent(state: LEXAState) -> dict:
    output = call_agent(
        "You are a prosecutor. Build the strongest case using the evidence and cited Indian law.",
        f"Evidence: {state.get('evidence')}\nLaws: {state.get('retrieved_laws')}",
    )
    return {"prosecution": output, "agent_trace": state.get("agent_trace", []) + [{"agent": "Prosecutor", "output": output}]}
