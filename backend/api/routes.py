from pathlib import Path
from tempfile import NamedTemporaryFile

from fastapi import APIRouter, BackgroundTasks, File, HTTPException, UploadFile
from pydantic import BaseModel

from graph.workflow import run_workflow
from processing.document_processor import extract_text_from_file
from services import supabase_client as db

router = APIRouter(prefix="/api/v1")


class TextCase(BaseModel):
    title: str
    text: str


def analyze_case(case_id: str) -> None:
    case = db.get_case(case_id)
    if not case:
        return
    db.update_case_status(case_id, "processing")
    try:
        state = run_workflow(
            {"case_id": case_id, "case_text": case["raw_text"]},
            on_step=lambda name, output: db.log_agent(case_id, name, output),
        )
        db.save_verdict(case_id, state)
        db.update_case_status(case_id, "completed")
    except Exception as exc:
        db.log_agent(case_id, "System", {"error": str(exc)})
        db.update_case_status(case_id, "failed")


@router.post("/upload")
async def upload_case(background_tasks: BackgroundTasks, file: UploadFile = File(...)):
    suffix = Path(file.filename or "case.txt").suffix.lower()
    if suffix not in {".pdf", ".txt"}:
        raise HTTPException(status_code=400, detail="Upload a PDF or TXT case document")

    with NamedTemporaryFile(delete=False, suffix=suffix) as temp:
        temp.write(await file.read())
        temp_path = temp.name

    try:
        text = extract_text_from_file(temp_path)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    finally:
        Path(temp_path).unlink(missing_ok=True)

    case_id = db.save_case(file.filename or "Uploaded case", text, file.filename)
    background_tasks.add_task(analyze_case, case_id)
    return {"case_id": case_id, "status": "processing"}


@router.post("/cases")
async def create_text_case(payload: TextCase, background_tasks: BackgroundTasks):
    if not payload.text.strip():
        raise HTTPException(status_code=400, detail="Case text cannot be empty")
    case_id = db.save_case(payload.title, payload.text)
    background_tasks.add_task(analyze_case, case_id)
    return {"case_id": case_id, "status": "processing"}


@router.post("/analyze/{case_id}")
async def analyze(case_id: str, background_tasks: BackgroundTasks):
    if not db.get_case(case_id):
        raise HTTPException(status_code=404, detail="Case not found")
    background_tasks.add_task(analyze_case, case_id)
    return {"case_id": case_id, "status": "processing"}


@router.get("/verdict/{case_id}")
async def verdict(case_id: str):
    verdict_record = db.get_verdict(case_id)
    if not verdict_record:
        case = db.get_case(case_id)
        if not case:
            raise HTTPException(status_code=404, detail="Case not found")
        return {"case_id": case_id, "status": case["status"], "verdict": None}
    return verdict_record


@router.get("/cases")
async def cases():
    return db.list_cases()


@router.get("/logs/{case_id}")
async def logs(case_id: str):
    return db.get_logs(case_id)
