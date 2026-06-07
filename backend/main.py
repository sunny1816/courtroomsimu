from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()

from config import settings

app = FastAPI(
    title="LEXA API",
    description="Autonomous multi-agent courtroom intelligence API",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from api.routes import router

app.include_router(router)


@app.get("/health")
async def health_check():
    mode = "mock" if settings.use_mock_llm else "nim-cloud"
    return {"status": "ok", "message": "LEXA API is running", "mode": mode}
