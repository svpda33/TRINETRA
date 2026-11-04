"""SQLAlchemy ORM models for NexTrAI persistent data storage."""

from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Index
from sqlalchemy.orm import relationship
from app.db import Base

class IntersectionModel(Base):
    """Monitored traffic intersection node."""
    __tablename__ = "intersections"

    intersection_id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    active_approach = Column(String, default="NORTH")
    created_at = Column(DateTime, default=datetime.utcnow)

    cameras = relationship("CameraModel", back_populates="intersection", cascade="all, delete-orphan")

class CameraModel(Base):
    """CCTV camera feed registered at an intersection approach."""
    __tablename__ = "cameras"

    camera_id = Column(String, primary_key=True, index=True)
    intersection_id = Column(String, ForeignKey("intersections.intersection_id"), nullable=False, index=True)
    name = Column(String, nullable=False)
    direction = Column(String, nullable=False)  # NORTH, SOUTH, EAST, WEST
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    video_src = Column(String, nullable=False)
    status = Column(String, default="ONLINE")
    created_at = Column(DateTime, default=datetime.utcnow)

    intersection = relationship("IntersectionModel", back_populates="cameras")
    detections = relationship("DetectionModel", back_populates="camera", cascade="all, delete-orphan")
    alerts = relationship("AlertModel", back_populates="camera", cascade="all, delete-orphan")
    metrics = relationship("TrafficMetricModel", back_populates="camera", cascade="all, delete-orphan")

class WatchlistModel(Base):
    """Security watchlist for flagged, stolen, or monitored vehicle license plates."""
    __tablename__ = "watchlist"

    id = Column(Integer, primary_key=True, autoincrement=True)
    plate_number = Column(String, unique=True, nullable=False, index=True)
    alert_type = Column(String, nullable=False)  # STOLEN_VEHICLE, CRIMINAL_SUSPECT, TRAFFIC_VIOLATOR, VIP_ESCORT
    severity = Column(String, default="HIGH")     # CRITICAL, HIGH, MEDIUM, LOW
    notes = Column(String, default="")
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    alerts = relationship("AlertModel", back_populates="watchlist_entry", cascade="all, delete-orphan")

class DetectionModel(Base):
    """Individual vehicle detection and ANPR recognition event."""
    __tablename__ = "detections"

    id = Column(Integer, primary_key=True, autoincrement=True)
    camera_id = Column(String, ForeignKey("cameras.camera_id"), nullable=False, index=True)
    track_id = Column(Integer, default=0, index=True)
    vehicle_class = Column(String, nullable=False)  # CAR, MOTORCYCLE, BUS, TRUCK, AUTO_RICKSHAW, AMBULANCE
    plate_number = Column(String, nullable=True, index=True)
    ocr_confidence = Column(Float, default=0.0)
    speed_kmh = Column(Float, default=0.0)
    heading = Column(String, default="NORTHBOUND")
    snapshot_path = Column(String, nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)

    camera = relationship("CameraModel", back_populates="detections")

    __table_args__ = (
        Index("idx_detections_plate_time", "plate_number", "timestamp"),
    )

class AlertModel(Base):
    """Active security or traffic violation alert generated on watchlist match."""
    __tablename__ = "alerts"

    id = Column(Integer, primary_key=True, autoincrement=True)
    watchlist_id = Column(Integer, ForeignKey("watchlist.id"), nullable=True, index=True)
    plate_number = Column(String, nullable=False, index=True)
    camera_id = Column(String, ForeignKey("cameras.camera_id"), nullable=False, index=True)
    severity = Column(String, default="HIGH")
    alert_type = Column(String, default="WATCHLIST_HIT")
    snapshot_path = Column(String, nullable=True)
    is_acknowledged = Column(Boolean, default=False)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
    notes = Column(String, default="")

    camera = relationship("CameraModel", back_populates="alerts")
    watchlist_entry = relationship("WatchlistModel", back_populates="alerts")

class TrafficMetricModel(Base):
    """Aggregated macro traffic flow analytics per camera interval."""
    __tablename__ = "traffic_metrics"

    id = Column(Integer, primary_key=True, autoincrement=True)
    camera_id = Column(String, ForeignKey("cameras.camera_id"), nullable=False, index=True)
    vehicle_count = Column(Integer, default=0)
    avg_speed = Column(Float, default=40.0)
    congestion_level = Column(String, default="LOW")  # LOW, MEDIUM, HIGH, CRITICAL
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)

    camera = relationship("CameraModel", back_populates="metrics")


class EmergencyEventModel(Base):
    """Persistent audit log of emergency priority activations across city intersections."""
    __tablename__ = "emergency_events"

    id = Column(Integer, primary_key=True, autoincrement=True)
    event_id = Column(String, index=True, nullable=False)
    trigger_camera_id = Column(String, nullable=False)
    intersection_id = Column(String, index=True, nullable=False)
    approach = Column(String, nullable=False)  # NORTH, SOUTH, EAST, WEST
    vehicle_class = Column(String, default="AMBULANCE")
    track_id = Column(Integer, default=0)
    trigger_source = Column(String, default="OPERATOR_TRIGGERED_OR_V2X_SIMULATED")
    status = Column(String, default="ACTIVE", index=True)  # ACTIVE, RELEASED, STALE_RESTART_INVALIDATED, CANCELLED
    initiated_at = Column(DateTime, default=datetime.utcnow, index=True)
    released_at = Column(DateTime, nullable=True)
    duration_sec = Column(Float, default=0.0)
    release_reason = Column(String, default="")
    notes = Column(String, default="")


class CorridorScheduleModel(Base):
    """Persistent tracking of staged downstream corridor preemption activations."""
    __tablename__ = "corridor_schedules"

    id = Column(Integer, primary_key=True, autoincrement=True)
    schedule_id = Column(String, unique=True, index=True, nullable=False)
    event_id = Column(String, index=True, nullable=False)
    upstream_iid = Column(String, nullable=False)
    downstream_iid = Column(String, nullable=False)
    approach = Column(String, nullable=False)
    target_activation_timestamp = Column(Float, nullable=False)
    staged_delay_sec = Column(Float, default=0.0)
    status = Column(String, default="PENDING_STAGED_ACTIVATION", index=True)  # PENDING_STAGED_ACTIVATION, ACTIVATED, CANCELLED, STALE_RESTART_INVALIDATED
    created_at = Column(DateTime, default=datetime.utcnow)
    activated_at = Column(DateTime, nullable=True)

