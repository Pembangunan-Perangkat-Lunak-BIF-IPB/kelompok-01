from fastapi import APIRouter

from app.api.routes.health import router as health_router
from app.api.routes.auth import router as auth_router
from app.api.routes.samples import router as samples_router
from app.api.routes.jobs import router as jobs_router
from app.api.routes.results import router as results_router

router = APIRouter()
router.include_router(health_router)
router.include_router(auth_router)
router.include_router(samples_router)
router.include_router(jobs_router)
router.include_router(results_router)
