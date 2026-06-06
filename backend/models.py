from pydantic import BaseModel
from typing import Optional


class Coord(BaseModel):
    lat: float
    lng: float


class PatientInfo(BaseModel):
    name: Optional[str] = None
    notes: Optional[str] = None


class DispatchRequest(BaseModel):
    ambulance_id: str
    pickup: Coord
    patient: Optional[PatientInfo] = None
    ambulance_position: Optional[Coord] = None  # fallback when ambulance GPS not yet streaming


class DispatchResponse(BaseModel):
    status: str
    ambulance_id: str
    duration_s: float
    distance_m: float


class Route(BaseModel):
    geometry: list[list[float]]   # [[lat, lng], ...]
    distance_m: float
    duration_s: float


# WebSocket message shapes (used for serialization only — JS mirrors these)

class GpsMessage(BaseModel):
    type: str = "gps"
    lat: float
    lng: float
    heading: Optional[float] = None
    ts: Optional[int] = None


class RouteMessage(BaseModel):
    type: str = "route"
    ambulance_id: str
    geometry: list[list[float]]
    distance_m: float
    duration_s: float
    pickup: Coord


class PositionMessage(BaseModel):
    type: str = "position"
    ambulance_id: str
    lat: float
    lng: float
    heading: Optional[float] = None


class SnapshotEntry(BaseModel):
    ambulance_id: str
    lat: float
    lng: float


class SnapshotMessage(BaseModel):
    type: str = "snapshot"
    ambulances: list[SnapshotEntry]


# ── Phase 2 models ─────────────────────────────────────────────────────────────

class Hospital(BaseModel):
    id: str
    name: str
    lat: float
    lng: float


class Incident(BaseModel):
    id: str
    type: str            # "congestion" (clearable) | "blockage" (not clearable)
    lat: float
    lng: float
    radius_m: float
    delay_min: float
    description: str = ""


class HospitalAlternative(BaseModel):
    name: str
    lat: float
    lng: float
    duration_s: float
    effective_duration_s: float


class SecurityRecommendation(BaseModel):
    recommended: bool
    reason: str
    incident_type: Optional[str] = None
    estimated_time_saved_s: Optional[float] = None
    incident_location: Optional[Coord] = None


class HospitalRouteMessage(BaseModel):
    type: str = "hospital_route"
    ambulance_id: str
    destination: dict
    geometry: list[list[float]]
    distance_m: float
    duration_s: float
    effective_duration_s: float
    alternatives: list[HospitalAlternative]
    security_recommendation: SecurityRecommendation
