from fastapi import APIRouter

from app.schemas.health import HealthResponse

router = APIRouter(tags=["health"])


@router.get(
    "/health",
    response_model=HealthResponse,
    summary="Check API liveness",
    description="Checks that the API responds, not database or worker readiness.",
)
async def get_health() -> HealthResponse:
    return HealthResponse(status="ok")
