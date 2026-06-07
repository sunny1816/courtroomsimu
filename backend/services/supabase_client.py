import json
import threading
import time
from datetime import datetime, timezone
from json import JSONDecodeError
from pathlib import Path
from uuid import uuid4

from config import settings


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


class LocalStore:
    def __init__(self, path: Path):
        self.path = path
        self.lock = threading.RLock()
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with self.lock:
            if not self.path.exists():
                self._write(self._empty_data())

    @staticmethod
    def _empty_data() -> dict:
        return {"cases": [], "verdicts": [], "agent_logs": []}

    def _read(self) -> dict:
        with self.lock:
            for attempt in range(5):
                try:
                    if not self.path.exists():
                        if attempt < 4:
                            time.sleep(0.1)
                            continue
                        data = self._empty_data()
                        self._write(data)
                        return data
                    
                    data = json.loads(self.path.read_text(encoding="utf-8"))
                    break
                except (PermissionError, FileNotFoundError, JSONDecodeError) as e:
                    if attempt < 4:
                        time.sleep(0.1)
                        continue
                    if isinstance(e, JSONDecodeError):
                        data = self._empty_data()
                        self._write(data)
                        return data
                    raise
            else:
                data = self._empty_data()
                self._write(data)
                return data

            for key, value in self._empty_data().items():
                data.setdefault(key, value)
            return data

    def _write(self, data: dict) -> None:
        with self.lock:
            temp_path = self.path.with_suffix(f"{self.path.suffix}.tmp")
            for attempt in range(5):
                try:
                    temp_path.write_text(json.dumps(data, indent=2), encoding="utf-8")
                    break
                except PermissionError:
                    if attempt < 4:
                        time.sleep(0.1)
                        continue
                    raise
            
            # Windows robust atomic replace
            for attempt in range(5):
                try:
                    if temp_path.exists():
                        temp_path.replace(self.path)
                    break
                except (PermissionError, FileNotFoundError):
                    time.sleep(0.1)
            else:
                for attempt in range(5):
                    try:
                        self.path.write_text(json.dumps(data, indent=2), encoding="utf-8")
                        break
                    except PermissionError:
                        if attempt < 4:
                            time.sleep(0.1)
                            continue
                        raise

    def save_case(self, title: str, text: str, file_path: str | None = None) -> str:
        with self.lock:
            data = self._read()
            case_id = str(uuid4())
            data["cases"].append(
                {"id": case_id, "title": title, "file_path": file_path, "raw_text": text, "status": "pending", "created_at": _now()}
            )
            self._write(data)
            return case_id

    def update_case_status(self, case_id: str, status: str) -> None:
        with self.lock:
            data = self._read()
            for case in data["cases"]:
                if case["id"] == case_id:
                    case["status"] = status
            self._write(data)

    def get_case(self, case_id: str) -> dict | None:
        with self.lock:
            data = self._read()
            return next((case for case in data["cases"] if case["id"] == case_id), None)

    def list_cases(self) -> list[dict]:
        with self.lock:
            data = self._read()
            verdict_by_case = {verdict["case_id"]: verdict for verdict in data["verdicts"]}
            return [{**case, "verdict": verdict_by_case.get(case["id"])} for case in reversed(data["cases"])]

    def save_verdict(self, case_id: str, state: dict) -> str:
        with self.lock:
            data = self._read()
            verdict_id = str(uuid4())
            jury = state.get("jury_vote", {})
            evidence = state.get("evidence", {})
            facts = evidence.get("facts", []) if isinstance(evidence, dict) else []
            summary = " ".join(str(item) for item in facts[:3]) if facts else "Evidence was extracted from the uploaded case record."
            record = {
                "id": verdict_id,
                "case_id": case_id,
                "verdict": state.get("final_verdict", "Insufficient Evidence"),
                "confidence": jury.get("confidence", 0),
                "evidence_summary": summary,
                "prosecution_args": state.get("prosecution", ""),
                "defense_args": state.get("defense", ""),
                "contradictions": state.get("contradictions", []),
                "retrieved_laws": state.get("retrieved_laws", []),
                "judge_reasoning": state.get("judge_reasoning", ""),
                "jury_vote": jury,
                "appeal_decision": state.get("appeal_decision", ""),
                "agent_trace": state.get("agent_trace", []),
                "created_at": _now(),
            }
            data["verdicts"] = [item for item in data["verdicts"] if item["case_id"] != case_id]
            data["verdicts"].append(record)
            self._write(data)
            return verdict_id

    def get_verdict(self, case_id: str) -> dict | None:
        with self.lock:
            data = self._read()
            return next((verdict for verdict in reversed(data["verdicts"]) if verdict["case_id"] == case_id), None)

    def log_agent(self, case_id: str, agent_name: str, output: object) -> None:
        with self.lock:
            data = self._read()
            data["agent_logs"].append({"id": str(uuid4()), "case_id": case_id, "agent_name": agent_name, "output": output, "created_at": _now()})
            self._write(data)

    def get_logs(self, case_id: str) -> list[dict]:
        with self.lock:
            data = self._read()
            return [log for log in data["agent_logs"] if log["case_id"] == case_id]

    def delete_case(self, case_id: str) -> bool:
        with self.lock:
            data = self._read()
            initial_count = len(data["cases"])
            data["cases"] = [case for case in data["cases"] if case["id"] != case_id]
            data["verdicts"] = [v for v in data["verdicts"] if v["case_id"] != case_id]
            data["agent_logs"] = [log for log in data["agent_logs"] if log["case_id"] != case_id]
            self._write(data)
            return len(data["cases"]) < initial_count

    def clear_history(self) -> None:
        with self.lock:
            self._write(self._empty_data())

class SupabaseStore:
    def __init__(self, url: str, service_role_key: str):
        from supabase import create_client
        self.client = create_client(url, service_role_key)

    def save_case(self, title: str, text: str, file_path: str | None = None) -> str:
        res = self.client.table("cases").insert({
            "title": title,
            "raw_text": text,
            "file_path": file_path,
            "status": "pending"
        }).execute()
        return res.data[0]["id"]

    def update_case_status(self, case_id: str, status: str) -> None:
        self.client.table("cases").update({"status": status}).eq("id", case_id).execute()

    def get_case(self, case_id: str) -> dict | None:
        res = self.client.table("cases").select("*").eq("id", case_id).execute()
        return res.data[0] if res.data else None

    def list_cases(self) -> list[dict]:
        cases_res = self.client.table("cases").select("*").order("created_at", desc=True).execute()
        if not cases_res.data:
            return []
        
        verdicts_res = self.client.table("verdicts").select("*").execute()
        verdict_by_case = {v["case_id"]: v for v in verdicts_res.data}
        
        return [{**case, "verdict": verdict_by_case.get(case["id"])} for case in cases_res.data]

    def save_verdict(self, case_id: str, state: dict) -> str:
        jury = state.get("jury_vote", {})
        evidence = state.get("evidence", {})
        facts = evidence.get("facts", []) if isinstance(evidence, dict) else []
        summary = " ".join(str(item) for item in facts[:3]) if facts else "Evidence was extracted from the uploaded case record."
        
        record = {
            "case_id": case_id,
            "verdict": state.get("final_verdict", "Insufficient Evidence"),
            "confidence": jury.get("confidence", 0),
            "evidence_summary": summary,
            "prosecution_args": state.get("prosecution", ""),
            "defense_args": state.get("defense", ""),
            "contradictions": state.get("contradictions", []),
            "retrieved_laws": state.get("retrieved_laws", []),
            "judge_reasoning": state.get("judge_reasoning", ""),
            "jury_vote": jury,
            "appeal_decision": state.get("appeal_decision", ""),
            "agent_trace": state.get("agent_trace", []),
        }
        
        self.client.table("verdicts").delete().eq("case_id", case_id).execute()
        res = self.client.table("verdicts").insert(record).execute()
        return res.data[0]["id"]

    def get_verdict(self, case_id: str) -> dict | None:
        res = self.client.table("verdicts").select("*").eq("case_id", case_id).order("created_at", desc=True).limit(1).execute()
        return res.data[0] if res.data else None

    def log_agent(self, case_id: str, agent_name: str, output: object) -> None:
        self.client.table("agent_logs").insert({
            "case_id": case_id,
            "agent_name": agent_name,
            "output": output
        }).execute()

    def get_logs(self, case_id: str) -> list[dict]:
        res = self.client.table("agent_logs").select("*").eq("case_id", case_id).order("created_at", desc=False).execute()
        return res.data

    def delete_case(self, case_id: str) -> bool:
        self.client.table("verdicts").delete().eq("case_id", case_id).execute()
        self.client.table("agent_logs").delete().eq("case_id", case_id).execute()
        res = self.client.table("cases").delete().eq("id", case_id).execute()
        return len(res.data) > 0

    def clear_history(self) -> None:
        self.client.table("verdicts").delete().neq("id", "00000000-0000-0000-0000-000000000000").execute()
        self.client.table("agent_logs").delete().neq("id", "00000000-0000-0000-0000-000000000000").execute()
        self.client.table("cases").delete().neq("id", "00000000-0000-0000-0000-000000000000").execute()


if settings.supabase_url.strip() and settings.supabase_service_role_key.strip():
    try:
        store = SupabaseStore(settings.supabase_url, settings.supabase_service_role_key)
    except Exception as e:
        print(f"Failed to initialize SupabaseStore, falling back to LocalStore: {e}")
        store = LocalStore(settings.local_store)
else:
    store = LocalStore(settings.local_store)


def save_case(title: str, text: str, file_path: str | None = None) -> str:
    return store.save_case(title, text, file_path)


def update_case_status(case_id: str, status: str) -> None:
    store.update_case_status(case_id, status)


def get_case(case_id: str) -> dict | None:
    return store.get_case(case_id)


def list_cases() -> list[dict]:
    return store.list_cases()


def save_verdict(case_id: str, state: dict) -> str:
    return store.save_verdict(case_id, state)


def get_verdict(case_id: str) -> dict | None:
    return store.get_verdict(case_id)


def log_agent(case_id: str, agent_name: str, output: object) -> None:
    store.log_agent(case_id, agent_name, output)


def get_logs(case_id: str) -> list[dict]:
    return store.get_logs(case_id)


def delete_case(case_id: str) -> bool:
    return store.delete_case(case_id)


def clear_history() -> None:
    store.clear_history()

