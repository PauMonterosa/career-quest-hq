from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select
from .api.routes import router
from .config import settings
from .database import Base, SessionLocal, engine
from .models import Agent
from .services.excel_importer import import_workbook

AGENTS = [
    ("atlas", "ATLAS", "Master Programme Scout", "Analytical explorer", "masters_archive", "#4b8cff", "map"),
    ("nova", "NOVA", "TFG and Research Scout", "Curious scientist", "tfg_laboratory", "#48c98a", "flask"),
    ("echo", "ECHO", "Email and Communication Assistant", "Diplomatic and precise", "mail_room", "#ef5b62", "envelope"),
    ("chronos", "CHRONOS", "Deadline Manager", "Strict but helpful", "control_room", "#f5c84c", "clock"),
    ("pixel", "PIXEL", "Portfolio and Project Coach", "Creative engineer", "portfolio_workshop", "#a775ff", "tools"),
]


def bootstrap() -> None:
    settings.project_root.joinpath("data").mkdir(parents=True, exist_ok=True)
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        if not db.scalar(select(Agent).limit(1)):
            for agent_id, name, role, personality, room, color, accessory in AGENTS:
                db.add(Agent(id=agent_id, name=name, role=role, personality=personality,
                    current_room=room, status="idle", task_queue=[],
                    avatar={"color": color, "accessory": accessory}))
            db.commit()
        if settings.workbook_path and settings.workbook_path.exists():
            from .models import MasterProgramme
            if not db.scalar(select(MasterProgramme).limit(1)):
                import_workbook(settings.workbook_path, db)


@asynccontextmanager
async def lifespan(_: FastAPI):
    bootstrap()
    yield


app = FastAPI(title="Career Quest HQ API", version="0.1.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origins.split(","),
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)(:\d+)?$",
    allow_credentials=True, allow_methods=["*"], allow_headers=["*"])
app.include_router(router)
