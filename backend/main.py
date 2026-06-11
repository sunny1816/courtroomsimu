from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()

from config import settings

app = FastAPI(
    title="LEXA API",
    description="Autonomous multi-agent courtroom intelligence API",
    version="2.0.0",
)

origins = settings.allowed_origins
allow_credentials = "*" not in origins

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=allow_credentials,
    allow_methods=["*"],
    allow_headers=["*"],
)

from api.routes import router
from api.training_routes import router as training_router

app.include_router(router)
app.include_router(training_router)


@app.get("/health")
async def health_check():
    from services.gpu_detector import detect_gpu
    gpu_tier, gpu_name = detect_gpu()
    mode = "mock" if settings.use_mock_llm else ("vllm" if settings.vllm_base_url else "nim-cloud")
    return {
        "status": "ok",
        "message": "LEXA API is running",
        "version": "2.0.0",
        "mode": mode,
        "gpu": {"tier": gpu_tier.value, "device": gpu_name},
    }
