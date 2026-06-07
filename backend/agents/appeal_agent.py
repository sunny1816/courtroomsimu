from graph.state import LEXAState
from services.nim_client import call_agent


def appeal_agent(state: LEXAState) -> dict:
    output = call_agent(
        "Review for procedural errors or missed evidence. Keep the appeal decision concise.",
        str(state),
    )
    return {"appeal_decision": output, "agent_trace": state.get("agent_trace", []) + [{"agent": "AppealCourt", "output": output}]}
