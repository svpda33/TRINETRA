"""Trinetra FastAPI Application Entrypoint."""

import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.api.health import router as health_router
from app.api.intersections import router as intersections_router
from app.api.priority import router as priority_router
from app.api.simulation import router as simulation_router
from app.api.websocket import router as websocket_router
from app.api.vision import router as vision_router
from app.api.ai import router as ai_router
from app.api.safety import router as safety_router
from app.services.simulation_engine import simulation_engine

logging.basicConfig(
    level=settings.LOG_LEVEL,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger("trinetra")

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.PROJECT_VERSION,
    description="Trinetra — Emergency-Aware, Self-Healing Traffic Signal Network API",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS if settings.CORS_ORIGINS != ["*"] else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/", tags=["Root"])
async def root():
    """Root endpoint providing deployment and health status."""
    return {
        "status": "online",
        "app": settings.PROJECT_NAME,
        "version": settings.PROJECT_VERSION,
        "environment": settings.ENVIRONMENT,
        "docs": "/docs",
        "health": "/api/health",
        "telemetry_ws": "/api/ws/telemetry"
    }

app.include_router(health_router, prefix="/api")
app.include_router(intersections_router, prefix="/api")
app.include_router(priority_router, prefix="/api")
app.include_router(simulation_router, prefix="/api")
app.include_router(websocket_router, prefix="/api")
app.include_router(vision_router, prefix="/api")
app.include_router(ai_router, prefix="/api")
app.include_router(safety_router)

@app.on_event("startup")
async def startup_event():
    logger.info(f"Starting {settings.PROJECT_NAME} v{settings.PROJECT_VERSION} in {settings.ENVIRONMENT} mode on port {settings.PORT}.")
    logger.info(f"Priority Hierarchy initialized with {len(settings.PRIORITY_HIERARCHY)} levels.")
    simulation_engine.start()

@app.on_event("shutdown")
async def shutdown_event():
    logger.info(f"Shutting down {settings.PROJECT_NAME}.")
    simulation_engine.stop()
