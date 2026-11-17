from fastapi import HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse


def authentication_error() -> HTTPException:
    return HTTPException(
        status_code=401,
        detail="Could not authenticate.",
        headers={"WWW-Authenticate": "Bearer"},
    )


async def service_unavailable(request: Request, exc: Exception) -> JSONResponse:
    # Do not serialize or log driver exceptions, SQL parameters, or settings.
    return JSONResponse(status_code=503, content={"detail": "Service unavailable."})


async def invalid_request(request: Request, exc: RequestValidationError) -> JSONResponse:
    # Validation errors can contain the entire body, including login credentials.
    return JSONResponse(
        status_code=422,
        content={"detail": [{
            "loc": ["body"],
            "msg": "Invalid request.",
            "type": "request_validation_error",
        }]},
    )
