from pathlib import Path
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    nim_api_key: str = ""
    nim_model: str = "meta/llama-3.1-8b-instruct"
    nim_base_url: str = "https://integrate.api.nvidia.com/v1"
    use_mock_llm: bool = Field(default=False, alias="LEXA_USE_MOCK_LLM")

    supabase_url: str = ""
    supabase_anon_key: str = ""
    supabase_service_role_key: str = ""
    local_store: Path = Field(default=Path("data/local_store.json"), alias="LEXA_LOCAL_STORE")
    cors_origins: str = Field(default="", alias="LEXA_CORS_ORIGINS")

    corpus_dir: Path = Path("data/corpus")
    index_dir: Path = Path("models/faiss_index")

    model_config = SettingsConfigDict(env_file=(".env", "backend/.env"), extra="ignore")

    @property
    def allowed_origins(self) -> list[str]:
        if not self.cors_origins.strip():
            return [
                "http://localhost:5173",
                "http://127.0.0.1:5173",
                "http://localhost:5174",
                "http://127.0.0.1:5174",
            ]
        return [origin.strip().rstrip("/") for origin in self.cors_origins.split(",") if origin.strip()]


settings = Settings()
