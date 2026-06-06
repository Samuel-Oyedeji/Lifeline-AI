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
