"""Database connection and session factory for NexTrAI."""

import os
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import declarative_base

# Ensure data directory exists
DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")
SNAPSHOTS_DIR = os.path.join(DATA_DIR, "snapshots")
os.makedirs(DATA_DIR, exist_ok=True)
os.makedirs(SNAPSHOTS_DIR, exist_ok=True)

DB_PATH = os.path.join(DATA_DIR, "nextrai.db")
DATABASE_URL = f"sqlite+aiosqlite:///{DB_PATH}"

engine = create_async_engine(
    DATABASE_URL,
    echo=False,
    connect_args={"check_same_thread": False},
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)

Base = declarative_base()

async def get_db():
    """Dependency provider yielding async DB session."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()

async def init_db():
    """Initializes tables and populates default seed data if empty."""
    from app.models.db_models import (
        CameraModel, IntersectionModel, WatchlistModel, DetectionModel, AlertModel, TrafficMetricModel,
        EmergencyEventModel, CorridorScheduleModel
    )
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    # Check and seed baseline cameras, intersections, and watchlist
    async with AsyncSessionLocal() as session:
        from sqlalchemy import select
        existing_cams = await session.execute(select(CameraModel))
        if not existing_cams.scalars().first():
            # Seed 4 Intersections (Hyderabad Smart IT Corridor)
            intersections = [
                IntersectionModel(
                    intersection_id="I1",
                    name="Cyber Towers Junction",
                    latitude=17.4504,
                    longitude=78.3808,
                    active_approach="NORTH"
                ),
                IntersectionModel(
                    intersection_id="I2",
                    name="Hitec City / Mindspace Junction",
                    latitude=17.4428,
                    longitude=78.3813,
                    active_approach="SOUTH"
                ),
                IntersectionModel(
                    intersection_id="I3",
                    name="Bio-Diversity Junction",
                    latitude=17.4325,
                    longitude=78.3728,
                    active_approach="EAST"
                ),
                IntersectionModel(
                    intersection_id="I4",
                    name="Gachibowli Junction",
                    latitude=17.4401,
                    longitude=78.3489,
                    active_approach="WEST"
                ),
            ]
            session.add_all(intersections)

            # Seed 8 Cameras across Corridor
            cameras = [
                CameraModel(
                    camera_id="CAM_I1_NORTH",
                    intersection_id="I1",
                    name="Cyber Towers North Approach",
                    direction="NORTH",
                    latitude=17.4510,
                    longitude=78.3808,
                    video_src="/videos/I1_NORTH.mp4",
                    status="ONLINE"
                ),
                CameraModel(
                    camera_id="CAM_I1_SOUTH",
                    intersection_id="I1",
                    name="Cyber Towers South Approach",
                    direction="SOUTH",
                    latitude=17.4498,
                    longitude=78.3808,
                    video_src="/videos/I1_SOUTH.mp4",
                    status="ONLINE"
                ),
                CameraModel(
                    camera_id="CAM_I1_EAST",
                    intersection_id="I1",
                    name="Cyber Towers East Approach",
                    direction="EAST",
                    latitude=17.4504,
                    longitude=78.3815,
                    video_src="/videos/I1_EAST.mp4",
                    status="ONLINE"
                ),
                CameraModel(
                    camera_id="CAM_I1_WEST",
                    intersection_id="I1",
                    name="Cyber Towers West Approach",
                    direction="WEST",
                    latitude=17.4504,
                    longitude=78.3801,
                    video_src="/videos/I1_WEST.mp4",
                    status="ONLINE"
                ),
                CameraModel(
                    camera_id="CAM_I2_NORTH",
                    intersection_id="I2",
                    name="Mindspace North Approach",
                    direction="NORTH",
                    latitude=17.4435,
                    longitude=78.3813,
                    video_src="/videos/I2_NORTH.mp4",
                    status="ONLINE"
                ),
                CameraModel(
                    camera_id="CAM_I2_SOUTH",
                    intersection_id="I2",
                    name="Mindspace South Approach",
                    direction="SOUTH",
                    latitude=17.4421,
                    longitude=78.3813,
                    video_src="/videos/I2_SOUTH.mp4",
                    status="ONLINE"
                ),
                CameraModel(
                    camera_id="CAM_I2_EAST",
                    intersection_id="I2",
                    name="Mindspace East Approach",
                    direction="EAST",
                    latitude=17.4428,
                    longitude=78.3820,
                    video_src="/videos/I2_EAST.mp4",
                    status="ONLINE"
                ),
                CameraModel(
                    camera_id="CAM_I2_WEST",
                    intersection_id="I2",
                    name="Mindspace West Approach",
                    direction="WEST",
                    latitude=17.4428,
                    longitude=78.3806,
                    video_src="/videos/I2_WEST.mp4",
                    status="ONLINE"
                ),
            ]
            session.add_all(cameras)

            # Seed sample watchlist entries
            watchlist = [
                WatchlistModel(
                    plate_number="TS09EA1234",
                    alert_type="STOLEN_VEHICLE",
                    severity="CRITICAL",
                    notes="White Honda City stolen from Banjara Hills. Cyberabad Police FIR #402/2026.",
                    is_active=True
                ),
                WatchlistModel(
                    plate_number="AP28BK5678",
                    alert_type="CRIMINAL_SUSPECT",
                    severity="HIGH",
                    notes="Black Scorpio wanted in robbery case. Central Crime Station lookout circular.",
                    is_active=True
                ),
                WatchlistModel(
                    plate_number="DL1CAB9999",
                    alert_type="TRAFFIC_VIOLATOR",
                    severity="MEDIUM",
                    notes="Commercial taxi with 14 pending red light and dangerous driving e-challans.",
                    is_active=True
                ),
            ]
            session.add_all(watchlist)
            await session.commit()

        # Seed baseline multi-camera sightings for demo plates if detections table is empty
        existing_dets = await session.execute(select(DetectionModel))
        if not existing_dets.scalars().first():
            from datetime import datetime, timedelta
            now = datetime.utcnow()

            # Multi-camera sightings along Cyber Towers (I1) -> Mindspace (I2) -> Bio-Diversity (I3)
            detections = [
                DetectionModel(
                    camera_id="CAM_I1_NORTH",
                    track_id=101,
                    vehicle_class="CAR",
                    plate_number="TS09EA1234",
                    ocr_confidence=0.94,
                    speed_kmh=44.0,
                    heading="SOUTHBOUND",
                    snapshot_path="/videos/I1_NORTH.mp4",
                    timestamp=now - timedelta(seconds=180)
                ),
                DetectionModel(
                    camera_id="CAM_I2_NORTH",
                    track_id=102,
                    vehicle_class="CAR",
                    plate_number="TS09EA1234",
                    ocr_confidence=0.96,
                    speed_kmh=43.7,
                    heading="SOUTHBOUND",
                    snapshot_path="/videos/I2_NORTH.mp4",
                    timestamp=now - timedelta(seconds=110)
                ),
                DetectionModel(
                    camera_id="CAM_I3_NORTH",
                    track_id=103,
                    vehicle_class="CAR",
                    plate_number="TS09EA1234",
                    ocr_confidence=0.95,
                    speed_kmh=42.0,
                    heading="SOUTHBOUND",
                    snapshot_path="/videos/I2_WEST.mp4",
                    timestamp=now - timedelta(seconds=50)
                ),
                DetectionModel(
                    camera_id="CAM_I1_EAST",
                    track_id=104,
                    vehicle_class="CAR",
                    plate_number="AP28BK5678",
                    ocr_confidence=0.91,
                    speed_kmh=38.5,
                    heading="WESTBOUND",
                    snapshot_path="/videos/I1_EAST.mp4",
                    timestamp=now - timedelta(seconds=240)
                ),
                DetectionModel(
                    camera_id="CAM_I2_WEST",
                    track_id=105,
                    vehicle_class="CAR",
                    plate_number="AP28BK5678",
                    ocr_confidence=0.93,
                    speed_kmh=41.2,
                    heading="WESTBOUND",
                    snapshot_path="/videos/I2_WEST.mp4",
                    timestamp=now - timedelta(seconds=165)
                ),
                DetectionModel(
                    camera_id="CAM_I1_NORTH",
                    track_id=106,
                    vehicle_class="MOTORCYCLE",
                    plate_number="TS07AB1122",
                    ocr_confidence=0.88,
                    speed_kmh=35.0,
                    heading="SOUTHBOUND",
                    snapshot_path=None,
                    timestamp=now - timedelta(seconds=120)
                ),
                DetectionModel(
                    camera_id="CAM_I1_SOUTH",
                    track_id=107,
                    vehicle_class="AUTO_RICKSHAW",
                    plate_number="TS09TR3344",
                    ocr_confidence=0.85,
                    speed_kmh=28.0,
                    heading="NORTHBOUND",
                    snapshot_path=None,
                    timestamp=now - timedelta(seconds=100)
                ),
                DetectionModel(
                    camera_id="CAM_I2_NORTH",
                    track_id=108,
                    vehicle_class="BUS",
                    plate_number="TS09Z9988",
                    ocr_confidence=0.92,
                    speed_kmh=32.0,
                    heading="SOUTHBOUND",
                    snapshot_path=None,
                    timestamp=now - timedelta(seconds=80)
                ),
                DetectionModel(
                    camera_id="CAM_I2_SOUTH",
                    track_id=109,
                    vehicle_class="TRUCK",
                    plate_number="AP16TH5566",
                    ocr_confidence=0.89,
                    speed_kmh=30.0,
                    heading="NORTHBOUND",
                    snapshot_path=None,
                    timestamp=now - timedelta(seconds=60)
                ),
            ]
            session.add_all(detections)
            await session.commit()
