from fastapi import FastAPI
from app.api.router import router
from app.core.config import Settings
from app.database import engine
from app import models

models.Base.metadata.create_all(bind=engine)

def create_app(settings: Settings | None = None) -> FastAPI:
    if settings is None:
        settings = Settings()

    application = FastAPI(title=settings.app_name, debug=settings.debug)
    application.state.settings = settings
    application.include_router(router)
    return application

app = create_app()