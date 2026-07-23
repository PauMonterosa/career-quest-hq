from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="CQHQ_")
    project_root: Path = Path(__file__).resolve().parents[2]
    database_url: str = ""
    workbook_path: Path | None = None
    cors_origins: str = "http://localhost:5173"

    def model_post_init(self, __context: object) -> None:
        if not self.database_url:
            self.database_url = f"sqlite:///{self.project_root / 'data' / 'career_quest.db'}"
        if self.workbook_path is None:
            self.workbook_path = self.project_root / "data" / "pla_master_tfg_jan_2026_2027.xlsx"


settings = Settings()

