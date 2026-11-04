"""NexTrAI FastAPI Application Entrypoint."""

import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import os
from fastapi.staticfiles import StaticFiles
from app.config import settings
from app.api.health import router as health_router
from app.api.intersections import router as intersections_router
from app.api.priority import router as priority_router
from app.api.simulation import router as simulation_router
from app.api.websocket import router as websocket_router
from app.api.vision import router as vision_router
from app.api.ai import router as ai_router
from app.api.safety import router as safety_router
from app.api.anpr import router as anpr_router
from app.api.trajectories import router as trajectories_router
from app.api.watchlist import router as watchlist_router
from app.api.gis import router as gis_router
from app.api.analytics import router as analytics_router
from app.api.geometry import router as geometry_router
from app.api.signals import router as signals_router
from app.api.corridor import router as corridor_router
from app.services.simulation_engine import simulation_engine
from app.db import init_db, SNAPSHOTS_DIR

logging.basicConfig(
    level=settings.LOG_LEVEL,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger("nextrai")

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(f"Starting {settings.PROJECT_NAME} v{settings.PROJECT_VERSION} in {settings.ENVIRONMENT} mode on port {settings.PORT}.")
    logger.info(f"Priority Hierarchy initialized with {len(settings.PRIORITY_HIERARCHY)} levels.")
    await init_db()

    # Stage 3.6.D: Reconcile emergency priority and staged corridor schedules across reboot
    from app.services.emergency_priority_service import emergency_priority_service
    await emergency_priority_service.reconcile_restart_recovery()
    
    # Wire live video ingestion events directly to the WebSocket broadcast pipeline
    from app.services.video_ingestion_service import video_ingestion_service
    video_ingestion_service.register_event_listener(simulation_engine.broadcast_cv_event_sync)
    
    simulation_engine.start()

    # Priority 6: Autonomous background 1 Hz clock loop for adaptive controllers & staged corridor preemption
    import asyncio
    from app.services.adaptive_signal_service import adaptive_signal_service
    from app.services.emergency_priority_service import emergency_priority_service

    async def _autonomous_clock_loop():
        logger.info("Autonomous signal controller & staged corridor preemption clock loop started (1 Hz).")
        while True:
            try:
                await asyncio.sleep(1.0)
                # Advance deterministic adaptive controllers for city intersections
                adaptive_signal_service.tick_intersection("I1", delta_sec=1.0)
                adaptive_signal_service.tick_intersection("I2", delta_sec=1.0)
                # Check staged downstream corridor activations and 90s safety timeouts
                emergency_priority_service.check_scheduled_preemptions_and_timeouts()
            except asyncio.CancelledError:
                logger.info("Autonomous clock loop cancelled.")
                break
            except Exception as e:
                logger.error(f"Error in autonomous clock loop: {e}", exc_info=True)

    clock_task = asyncio.create_task(_autonomous_clock_loop())

    yield
    logger.info(f"Shutting down {settings.PROJECT_NAME}.")
    clock_task.cancel()
    try:
        await clock_task
    except asyncio.CancelledError:
        pass
    for cid in list(video_ingestion_service.workers.keys()):
        video_ingestion_service.stop_camera(cid)
    simulation_engine.stop()

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.PROJECT_VERSION,
    description="NexTrAI — City-Wide AI Engine for Multi-Camera ANPR Trajectory Tracking & Urban Traffic Analytics API",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# Static files for plate and vehicle snapshot crops
os.makedirs(SNAPSHOTS_DIR, exist_ok=True)
app.mount("/snapshots", StaticFiles(directory=SNAPSHOTS_DIR), name="snapshots")

# Robust CORS middleware supporting development, Vercel previews, and Railway deployments
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1|.*\.vercel\.app|.*\.up\.railway\.app)(:\d+)?$",
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
        "telemetry_ws": "/api/ws/telemetry",
        "platform": "Urban Traffic Intelligence & Management Platform",
        "category": "Intelligent Transportation Systems (ITS)"
    }

app.include_router(health_router, prefix="/api")
app.include_router(intersections_router, prefix="/api")
app.include_router(priority_router, prefix="/api")
app.include_router(simulation_router, prefix="/api")
app.include_router(websocket_router, prefix="/api")
app.include_router(vision_router, prefix="/api")
app.include_router(ai_router, prefix="/api")
app.include_router(safety_router)
app.include_router(anpr_router, prefix="/api")
app.include_router(trajectories_router, prefix="/api")
app.include_router(watchlist_router, prefix="/api")
app.include_router(gis_router, prefix="/api")
app.include_router(analytics_router, prefix="/api")
app.include_router(geometry_router, prefix="/api")
app.include_router(signals_router, prefix="/api")
app.include_router(corridor_router, prefix="/api")
