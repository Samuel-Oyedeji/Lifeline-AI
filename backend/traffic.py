import math
from models import Incident


def _haversine_m(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    R = 6_371_000
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = math.sin(dlat / 2) ** 2 + (
        math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlng / 2) ** 2
    )
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


class MockIncidentStore:
    def __init__(self) -> None:
        self._incidents: dict[str, Incident] = {}
        self._counter = 0

    def add(self, data: dict) -> Incident:
        self._counter += 1
        inc_id = f"inc-{self._counter}"
        incident = Incident(id=inc_id, **data)
        self._incidents[inc_id] = incident
        return incident

    def remove(self, inc_id: str) -> bool:
        return self._incidents.pop(inc_id, None) is not None

    def clear(self) -> None:
        self._incidents.clear()

    def all(self) -> list[Incident]:
        return list(self._incidents.values())

    def get(self, inc_id: str) -> Incident | None:
        return self._incidents.get(inc_id)


def incidents_on_route(
    geometry: list[list[float]],   # [[lat, lng], ...]
    incidents: list[Incident],
) -> list[Incident]:
    """Return incidents whose radius overlaps any vertex of the route geometry.

    Approximation: checks vertices only, not segments. Adequate for the mock
    stage; could miss incidents between sparse vertices on long straight roads.
    """
    result = []
    for incident in incidents:
        for vertex in geometry:
            dist = _haversine_m(vertex[0], vertex[1], incident.lat, incident.lng)
            if dist <= incident.radius_m:
                result.append(incident)
                break
    return result


incident_store = MockIncidentStore()
