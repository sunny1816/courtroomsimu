import json
import time
import re
import contextvars
from ast import literal_eval
from openai import OpenAI

from config import settings

case_id_var = contextvars.ContextVar("case_id", default="")
warning_logged_var = contextvars.ContextVar("warning_logged", default=False)


def _trigger_fallback_warning():
    case_id = case_id_var.get()
    if case_id and not warning_logged_var.get():
        try:
            from services import supabase_client as db
            db.log_agent(case_id, "System", {"warning": "NIM unavailable. Using fallback model."})
            warning_logged_var.set(True)
        except Exception as e:
            print(f"Error logging fallback warning: {e}")


def _extract_evidence(user_content: str) -> dict:
    match = re.search(r"Evidence:\s*(.*?)\nLaws:", user_content, flags=re.DOTALL)
    if not match:
        return {}
    try:
        value = literal_eval(match.group(1).strip())
    except (SyntaxError, ValueError):
        return {}
    return value if isinstance(value, dict) else {}


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
        ignored_names = {"The", "A", "An", "Case", "Sample", "State", "Police", "Court"}
        names = sorted({name for name in re.findall(r"\b[A-Z][a-z]{2,}\b", body) if name not in ignored_names})[:6]
        times = re.findall(r"\b\d{1,2}:\d{2}\s?(?:AM|PM|am|pm)?\b", body)
        facts = []
        for sentence in re.split(r"(?<=[.!?])\s+", body):
            clean = sentence.strip()
            if clean:
                facts.append(clean)
            if len(facts) == 4:
                break
        return json.dumps(
            {
                "facts": facts or ["Case document reviewed"],
                "people": names,
                "dates": times,
                "events": ["Incident described in uploaded case", "Evidence and defenses separated for review"],
            }
        )
    if "prosecutor" in prompt:
        evidence = _extract_evidence(user_content)
        facts = evidence.get("facts", []) if isinstance(evidence.get("facts"), list) else []
        lead = " ".join(str(item) for item in facts[:2]) or "The record contains a complaint, witness account, and recovery material."
        return (
            "The prosecution says the complaint, witness account, recovery details, and surrounding conduct form a connected chain. "
            f"The strongest points are that {lead}"
        )
    if "defense counsel" in prompt:
        return "The defense presses reasonable doubt on identification, intent, witness reliability, forensic certainty, and whether the cited law is fully matched to the facts."
    if "factual conflicts" in prompt:
        return '[{"statement_a":"Prosecution relies on the complaint","statement_b":"Defense disputes proof beyond doubt","conflict":"Evidentiary sufficiency"}]'
    if "impartially" in prompt:
        return "The court weighs the witness account, recovery material, medical outcome, and defense doubts against the cited law. The prosecution has a coherent chain, but confidence depends on identification and forensic support."
    if "vote independently" in prompt:
        return '{"verdict":"Guilty","confidence":0.64,"votes":{"guilty":3,"not_guilty":1,"abstain":1}}'
    if "procedural errors" in prompt:
        return "Appeal review finds no clear procedural error, but recommends fuller evidence collection before a final adverse finding."
    return sample or "No content supplied."


def call_agent(system_prompt: str, user_content: str) -> str:
    if settings.use_mock_llm:
        return _mock_response(system_prompt, user_content)

    import os
    errors = []

    # 1. NVIDIA NIM
    if settings.nim_api_key:
        try:
            client = OpenAI(base_url=settings.nim_base_url, api_key=settings.nim_api_key, timeout=20.0)
            response = client.chat.completions.create(
                model=settings.nim_model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_content},
                ],
                temperature=0.3,
                max_tokens=1024,
            )
            return response.choices[0].message.content or ""
        except Exception as exc:
            errors.append(f"NVIDIA NIM failed: {exc}")
    else:
        errors.append("NVIDIA NIM skipped: nim_api_key not set")

    # If NIM failed or was skipped, trigger the fallback warning log
    _trigger_fallback_warning()

    # 2. OpenRouter
    or_key = settings.openrouter_api_key or os.environ.get("OPENROUTER_API_KEY", "")
    if or_key:
        try:
            client = OpenAI(base_url=settings.openrouter_base_url, api_key=or_key, timeout=20.0)
            response = client.chat.completions.create(
                model=settings.openrouter_model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_content},
                ],
                temperature=0.3,
                max_tokens=1024,
            )
            return response.choices[0].message.content or ""
        except Exception as exc:
            errors.append(f"OpenRouter failed: {exc}")
    else:
        errors.append("OpenRouter skipped: openrouter_api_key not set")

    # 3. Groq
    groq_key = settings.groq_api_key or os.environ.get("GROQ_API_KEY", "")
    if groq_key:
        try:
            client = OpenAI(base_url=settings.groq_base_url, api_key=groq_key, timeout=20.0)
            response = client.chat.completions.create(
                model=settings.groq_model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_content},
                ],
                temperature=0.3,
                max_tokens=1024,
            )
            return response.choices[0].message.content or ""
        except Exception as exc:
            errors.append(f"Groq failed: {exc}")
    else:
        errors.append("Groq skipped: groq_api_key not set")

    # 4. Mock Model
    print(f"Fallback warning: All LLM providers failed. Errors: {errors}")
    return _mock_response(system_prompt, user_content)
