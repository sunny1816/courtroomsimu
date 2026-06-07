from agents.appeal_agent import appeal_agent
from agents.contradiction_agent import contradiction_agent
from agents.defense_agent import defense_agent
from agents.evidence_agent import evidence_agent
from agents.judge_agent import judge_agent
from agents.jury_agent import jury_agent
from agents.prosecutor_agent import prosecutor_agent
from graph.state import LEXAState
from retrieval.retriever import legal_research


STEPS = [
    ("Evidence", evidence_agent),
    ("LegalResearch", legal_research),
    ("Prosecutor", prosecutor_agent),
    ("Defense", defense_agent),
    ("ContradictionDetector", contradiction_agent),
    ("Judge", judge_agent),
    ("Jury", jury_agent),
    ("AppealCourt", appeal_agent),
]


def run_workflow(initial_state: LEXAState, on_step=None) -> LEXAState:
    state: LEXAState = dict(initial_state)
    state.setdefault("agent_trace", [])
    for name, step in STEPS:
        updates = step(state)
        state.update(updates)
        if on_step:
            on_step(name, updates)
    return state


try:
    from langgraph.graph import END, StateGraph

    def create_langgraph_app():
        graph = StateGraph(LEXAState)
        for name, step in STEPS:
            graph.add_node(name, step)
        graph.set_entry_point(STEPS[0][0])
        for (current, _), (next_name, _) in zip(STEPS, STEPS[1:]):
            graph.add_edge(current, next_name)
        graph.add_edge(STEPS[-1][0], END)
        return graph.compile()

except Exception:
    create_langgraph_app = None
