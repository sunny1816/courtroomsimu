from graph.workflow import run_workflow
from retrieval.retriever import retrieve_laws


def test_retriever_returns_law_sections():
    results = retrieve_laws("murder punishment bodily injury")
    assert results
    assert "text" in results[0]


def test_workflow_runs_end_to_end():
    state = run_workflow(
        {
            "case_id": "test-case",
            "case_text": "The accused allegedly caused death after threatening the victim. Witness statements are disputed.",
        }
    )
    assert state["evidence"]
    assert state["retrieved_laws"]
    assert state["prosecution"]
    assert state["defense"]
    assert state["final_verdict"]
