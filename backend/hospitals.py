import time
import httpx
from models import Coord, Hospital

OVERPASS_URL = "https://overpass-api.de/api/interpreter"
TIMEOUT = 25.0
CACHE_TTL = 300   # 5 minutes

_cache: dict[tuple, tuple[float, list[Hospital]]] = {}


class HospitalError(Exception):
    pass


def _cache_key(lat: float, lng: float, radius: int) -> tuple:
    return (round(lat, 2), round(lng, 2), radius)


def _overpass_query(lat: float, lng: float, radius: int) -> str:
    return (
        f"[out:json][timeout:25];"
        f"("
        f'  node["amenity"="hospital"](around:{radius},{lat},{lng});'
        f'  way["amenity"="hospital"](around:{radius},{lat},{lng});'
        f'  relation["amenity"="hospital"](around:{radius},{lat},{lng});'
        f");"
        f"out center;"
    )


def _parse_elements(elements: list[dict]) -> list[Hospital]:
    seen_names: set[str] = set()
    seen_coords: set[tuple] = set()
    hospitals: list[Hospital] = []

    for el in elements:
        el_type = el.get("type", "")
        el_id = el.get("id", 0)
        tags = el.get("tags", {})

        if el_type == "node":
            lat = el.get("lat")
            lng = el.get("lon")
        else:
            center = el.get("center", {})
            lat = center.get("lat")
            lng = center.get("lon")

        if lat is None or lng is None:
            continue

        name = tags.get("name") or "Unnamed hospital"
        name_key = name.lower().strip()
        coord_key = (round(lat, 3), round(lng, 3))

        if name_key in seen_names or coord_key in seen_coords:
            continue

        seen_names.add(name_key)
        seen_coords.add(coord_key)
        hospitals.append(Hospital(
            id=f"{el_type}/{el_id}",
            name=name,
            lat=lat,
            lng=lng,
        ))

    return hospitals


async def _fetch(lat: float, lng: float, radius: int) -> list[Hospital]:
    key = _cache_key(lat, lng, radius)
    now = time.monotonic()
    if key in _cache:
        ts, results = _cache[key]
        if now - ts < CACHE_TTL:
            return results

    query = _overpass_query(lat, lng, radius)
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            resp = await client.post(
                OVERPASS_URL,
                data={"data": query},
                headers={
                    "Accept": "*/*",
                    "Content-Type": "application/x-www-form-urlencoded",
                    "User-Agent": "LifeLineAI/1.0 ambulance-dispatch",
                },
            )
            resp.raise_for_status()
            data = resp.json()
    except httpx.TimeoutException as e:
        raise HospitalError("Overpass request timed out") from e
    except httpx.HTTPError as e:
        raise HospitalError(f"Overpass HTTP error: {e}") from e

    hospitals = _parse_elements(data.get("elements", []))
    _cache[key] = (now, hospitals)
    return hospitals


async def find_nearby_hospitals(location: Coord, radius_m: int = 5000) -> list[Hospital]:
    """Return hospitals near location.  Expands radius once if initial search is empty."""
    hospitals = await _fetch(location.lat, location.lng, radius_m)
    if not hospitals:
        expanded = min(radius_m * 2, 20000)
        hospitals = await _fetch(location.lat, location.lng, expanded)
    return hospitals
