"""
LLM provider abstraction for LEXA agents.

Priority order (first configured provider wins):
  1. vLLM   — local GPU server (fastest, no cost, set VLLM_BASE_URL)
  2. NVIDIA NIM  — cloud inference (set NIM_API_KEY)
  3. OpenRouter  — free-tier cloud (set OPENROUTER_API_KEY)
  4. Groq        — free-tier cloud (set GROQ_API_KEY)
  5. Mock        — deterministic rule-based responses (development / demo)
"""

import json
import re
import contextvars
from ast import literal_eval
from openai import OpenAI

from config import settings

case_id_var = contextvars.ContextVar("case_id", default="")
warning_logged_var = contextvars.ContextVar("warning_logged", default=False)


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _log_fallback_warning():
    case_id = case_id_var.get()
    if case_id and not warning_logged_var.get():
        try:
            from services import supabase_client as db
            db.log_agent(case_id, "System", {"warning": "Primary LLM unavailable — using fallback provider."})
            warning_logged_var.set(True)
        except Exception:
            pass


def _extract_evidence(user_content: str) -> dict:
    match = re.search(r"Evidence:\s*(.*?)\nLaws:", user_content, flags=re.DOTALL)
    if not match:
        return {}
    try:
        value = literal_eval(match.group(1).strip())
    except (SyntaxError, ValueError):
        return {}
    return value if isinstance(value, dict) else {}


# ---------------------------------------------------------------------------
# Mock responses (development / demo mode)
# ---------------------------------------------------------------------------

def _mock_response(system_prompt: str, user_content: str) -> str:
    prompt = system_prompt.lower()
    text = " ".join(user_content.split())
    sample = text[:280]

    if "extract facts" in prompt:
        body = " ".join(
            line.strip()
            for line in user_content.splitlines()
            if line.strip() and not line.lower().startswith(("sample case:", "case:"))
        )
        ignored = {"The", "A", "An", "Case", "Sample", "State", "Police", "Court"}
        names = sorted({n for n in re.findall(r"\b[A-Z][a-z]{2,}\b", body) if n not in ignored})[:6]
        times = re.findall(r"\b\d{1,2}:\d{2}\s?(?:AM|PM|am|pm)?\b", body)
        facts = []
        for sentence in re.split(r"(?<=[.!?])\s+", body):
            clean = sentence.strip()
            if clean:
                facts.append(clean)
            if len(facts) == 4:
                break
        return json.dumps({
            "facts": facts or ["Case document reviewed"],
            "people": names,
            "dates": times,
            "events": ["Incident described in uploaded case", "Evidence and defences separated for review"],
        })

    if "prosecutor" in prompt:
        evidence = _extract_evidence(user_content)
        facts = evidence.get("facts", []) if isinstance(evidence.get("facts"), list) else []
        lead = " ".join(str(i) for i in facts[:2]) or "The record contains a complaint, witness account, and recovery material."
        return (
            "The prosecution says the complaint, witness account, recovery details, and surrounding conduct "
            f"form a connected chain. The strongest points are that {lead}"
        )

    if "defense counsel" in prompt:
        return (
            "The defence presses reasonable doubt on identification, intent, witness reliability, "
            "forensic certainty, and whether the cited law is fully matched to the facts."
        )

    if "factual conflicts" in prompt:
        return '[{"statement_a":"Prosecution relies on the complaint","statement_b":"Defence disputes proof beyond doubt","conflict":"Evidentiary sufficiency"}]'

    if "impartially" in prompt:
        return (
            "The court weighs the witness account, recovery material, medical outcome, and defence doubts "
            "against the cited law. The prosecution has a coherent chain, but confidence depends on "
            "identification and forensic support."
        )

    if "vote independently" in prompt:
        return '{"verdict":"Guilty","confidence":0.64,"votes":{"guilty":3,"not_guilty":1,"abstain":1}}'

    if "procedural errors" in prompt:
        return "Appeal review finds no clear procedural error, but recommends fuller evidence collection before a final adverse finding."

    return sample or "No content supplied."


# ---------------------------------------------------------------------------
# Provider calls
# ---------------------------------------------------------------------------

def _call_openai_compat(base_url: str, api_key: str, model: str,
                         system_prompt: str, user_content: str,
                         timeout: float = 30.0) -> str:
    client = OpenAI(base_url=base_url, api_key=api_key, timeout=timeout)
    response = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content},
        ],
        temperature=0.3,
        max_tokens=1024,
    )
    return response.choices[0].message.content or ""


# ---------------------------------------------------------------------------
# Main dispatch
# ---------------------------------------------------------------------------

def call_agent(system_prompt: str, user_content: str) -> str:
    if settings.use_mock_llm:
        return _mock_response(system_prompt, user_content)

    import os
    errors: list[str] = []

    # 0. LEXA local fine-tuned adapter (highest priority when enabled)
    #    Activate with LEXA_USE_LOCAL_MODEL=true in backend/.env
    if settings.use_local_model:
        try:
            from services.lexa_local_client import is_available, call_lexa_local
            if is_available():
                return call_lexa_local(system_prompt, user_content)
            errors.append("LEXA local model: adapter not trained yet — falling through to cloud")
        except Exception as exc:
            errors.append(f"LEXA local model failed: {exc}")
            _log_fallback_warning()

    # 1. vLLM — local GPU server (highest priority)
    if settings.vllm_base_url:
        try:
            return _call_openai_compat(
                settings.vllm_base_url, "not-needed", settings.vllm_model,
                system_prompt, user_content, timeout=120.0,
            )
        except Exception as exc:
            errors.append(f"vLLM failed: {exc}")
            _log_fallback_warning()

    # 2. NVIDIA NIM
    if settings.nim_api_key:
        try:
            return _call_openai_compat(
                settings.nim_base_url, settings.nim_api_key, settings.nim_model,
                system_prompt, user_content, timeout=30.0,
            )
        except Exception as exc:
            errors.append(f"NIM failed: {exc}")
            _log_fallback_warning()
    else:
        errors.append("NIM skipped: nim_api_key not set")

    # 3. OpenRouter
    or_key = settings.openrouter_api_key or os.environ.get("OPENROUTER_API_KEY", "")
    if or_key:
        try:
            return _call_openai_compat(
                settings.openrouter_base_url, or_key, settings.openrouter_model,
                system_prompt, user_content, timeout=30.0,
            )
        except Exception as exc:
            errors.append(f"OpenRouter failed: {exc}")
    else:
        errors.append("OpenRouter skipped: openrouter_api_key not set")

    # 4. Groq
    groq_key = settings.groq_api_key or os.environ.get("GROQ_API_KEY", "")
    if groq_key:
        try:
            return _call_openai_compat(
                settings.groq_base_url, groq_key, settings.groq_model,
                system_prompt, user_content, timeout=30.0,
            )
        except Exception as exc:
            errors.append(f"Groq failed: {exc}")
    else:
        errors.append("Groq skipped: groq_api_key not set")

    # 5. Mock fallback
    print(f"[LEXA] All LLM providers failed — using mock. Errors: {errors}")
    return _mock_response(system_prompt, user_content)
