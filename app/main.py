from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware  # [BARU] Import CORSMiddleware
from sqlalchemy.exc import DBAPIError, TimeoutError as DatabaseTimeoutError

from app.api.dependencies import bearer_scheme
from app.api.errors import invalid_request, service_unavailable
from app.api.router import router
from app.core.config import Settings
from app.core.security import SecurityConfigurationError
from app.database import DatabaseConfigurationError
from app.schemas.result import ResultSummary, VariantPage


def create_app(settings: Settings | None = None) -> FastAPI:
    if settings is None:
        settings = Settings()

    application = FastAPI(title=settings.app_name, debug=settings.debug)
    application.state.settings = settings

    # [BARU] Konfigurasi CORS agar React (port 5173) bisa berkomunikasi dengan backend
    application.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "http://localhost:5173",
            "http://127.0.0.1:5173",
        ],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    application.add_exception_handler(RequestValidationError, invalid_request)
    for error_type in (
        SecurityConfigurationError, DatabaseConfigurationError, DBAPIError, DatabaseTimeoutError
    ):
        application.add_exception_handler(error_type, service_unavailable)
    application.include_router(router)

    # Expose the future business API's Bearer scheme without inventing a route
    # or requiring a token on login/health. Preserve FastAPI's schema cache.
    default_openapi = application.openapi

    def openapi():
        schema = default_openapi()
        schema.setdefault("components", {}).setdefault("securitySchemes", {})[
            bearer_scheme.scheme_name
        ] = bearer_scheme.model.model_dump(mode="json", by_alias=True, exclude_none=True)
        # FastAPI's OpenAPI encoder drops None values, including required
        # nullable fields inside examples (such as next_offset on the last page).
        # Restore validated public DTO examples after that encoding step.
        components = schema.get("components", {}).get("schemas", {})
        for model in (ResultSummary, VariantPage):
            if model.__name__ in components:
                examples = model.model_config["json_schema_extra"]["examples"]
                components[model.__name__]["examples"] = [
                    model.model_validate(example).model_dump(mode="json") for example in examples
                ]
        return schema

    application.openapi = openapi
    return application

app = create_app()