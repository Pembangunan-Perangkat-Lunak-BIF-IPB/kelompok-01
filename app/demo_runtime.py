"""Single-origin, gate-protected SPA and API runtime for the local demo."""
from pathlib import Path

from fastapi import FastAPI

from app.core.config import Settings
from app.demo import demo_app, read_demo_gate_config
from app.main import create_app


ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / "frontend" / "dist"
GATE_CONFIG = ROOT / ".runtime" / "gate.json"


def create_demo_app(
    settings: Settings | None = None,
    api: FastAPI | None = None,
    dist: Path = DIST,
    config_path: Path = GATE_CONFIG,
) -> FastAPI:
    config = read_demo_gate_config(config_path)
    settings = settings or Settings()
    return demo_app(api or create_app(settings), dist, config, config_path=config_path)


app = create_demo_app()
