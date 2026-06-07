# LEXA

LEXA is a capstone-ready courtroom intelligence demo. A user submits a legal case document, and six AI agents analyze evidence, argue prosecution and defense positions, detect contradictions, produce a verdict, and show the full reasoning trace.

The app is intentionally simple: FastAPI backend, React + TypeScript frontend, LangGraph-style workflow, NVIDIA NIM-compatible LLM calls, FAISS-ready retrieval, and Supabase-compatible persistence.

## Architecture

```text
Browser
  -> React + TypeScript dashboard
  -> FastAPI API
      -> Document processor (PDF/TXT)
      -> Legal retriever (FAISS chunks or keyword fallback)
      -> Agent workflow
          Evidence -> LegalResearch -> Prosecutor -> Defense
          -> ContradictionDetector -> Judge -> Jury -> AppealCourt
      -> Supabase tables, or local JSON fallback for development
```

## Project Structure

```text
backend/
  api/routes.py
  agents/
  graph/
  processing/
  retrieval/
  services/
frontend/
  src/components/
  src/pages/
  src/lib/
data/
  corpus/
  sample_cases/
models/
  faiss_index/
requirements.txt
docs_schema.sql
```

## Setup

1. Create the Python environment and install backend dependencies.

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

2. Install frontend dependencies.

```powershell
cd frontend
pnpm install
```

3. Copy `.env.example` to `.env` and fill service keys when available.

```text
NIM_API_KEY=...
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
LEXA_USE_MOCK_LLM=false
```

For local demos without keys, leave `LEXA_USE_MOCK_LLM=true`. The backend uses deterministic mock agent responses and `data/local_store.json`.

4. Create Supabase tables with `docs_schema.sql` and create a `case-documents` bucket.

5. Start the app.

```powershell
.\.venv\Scripts\python.exe -m uvicorn main:app --app-dir backend --reload --port 8000
cd frontend
pnpm run dev
```

## Verified Commands

```powershell
.\.venv\Scripts\python.exe -m pytest backend\tests -q
cd frontend
node node_modules\typescript\bin\tsc -b
node node_modules\vite\bin\vite.js build
```

## API

- `POST /api/v1/upload` uploads a PDF or TXT file and starts analysis.
- `POST /api/v1/cases` submits raw case text and starts analysis.
- `POST /api/v1/analyze/{case_id}` reruns analysis for an existing case.
- `GET /api/v1/logs/{case_id}` returns live agent trace logs.
- `GET /api/v1/verdict/{case_id}` returns the verdict payload.
- `GET /api/v1/cases` returns case history.

## Agent Roles

- Evidence: extracts facts, people, dates, and events.
- LegalResearch: retrieves relevant Indian law chunks.
- Prosecutor: builds the strongest case for guilt.
- Defense: challenges prosecution claims.
- ContradictionDetector: flags factual conflicts.
- Judge: weighs both sides and applies cited law.
- Jury: votes and assigns confidence.
- AppealCourt: reviews for missed evidence or procedure issues.

## Demo Script

1. Open the dashboard and point out the intake panel, live trace, verdict, and history.
2. Click `Analyze Text` with the bundled sample case.
3. Watch all eight workflow steps complete.
4. Walk through the verdict, confidence, citations, judge reasoning, and appeal review.
5. Select earlier cases from history to show persistence.

## Demo Validation

The five-case validation table is in `demo_results.md`. It includes guilty and insufficient-evidence outcomes to show the jury scorer is not fixed to a single verdict.
