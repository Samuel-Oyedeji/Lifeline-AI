import math
import os

import httpx
from models import Coord, Route


OSRM_BASE  = os.environ.get("OSRM_BASE_URL",  "https://router.project-osrm.org/route/v1/driving")
OSRM_TABLE = os.environ.get("OSRM_TABLE_URL", "https://router.project-osrm.org/table/v1/driving")
TIMEOUT = 8.0


class RoutingError(Exception):
    pass


def _haversine_m(a: Coord, b: Coord) -> float:
    R = 6_371_000
    dlat = math.radians(b.lat - a.lat)
    dlng = math.radians(b.lng - a.lng)
    h = math.sin(dlat / 2) ** 2 + math.cos(math.radians(a.lat)) * math.cos(math.radians(b.lat)) * math.sin(dlng / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(h), math.sqrt(1 - h))


def _straight_line_route(origin: Coord, dest: Coord) -> Route:
    """Fallback when OSRM is unreachable — straight line, 30 km/h estimate."""
    dist_m = _haversine_m(origin, dest)
    duration_s = dist_m / (30_000 / 3600)  # 30 km/h average
    return Route(
        geometry=[[origin.lat, origin.lng], [dest.lat, dest.lng]],
        distance_m=dist_m,
        duration_s=duration_s,
    )


async def get_candidate_routes(origin: Coord, dest: Coord) -> list[Route]:
    url = (
        f"{OSRM_BASE}/{origin.lng},{origin.lat};{dest.lng},{dest.lat}"
        "?overview=full&geometries=geojson&alternatives=true&steps=false"
    )
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            data = resp.json()
    except (httpx.TimeoutException, httpx.ConnectError) as e:
        print(f"[ROUTING] OSRM unreachable ({e}), using straight-line fallback")
        return [_straight_line_route(origin, dest)]
    except httpx.HTTPError as e:
        raise RoutingError(f"OSRM HTTP error: {e}") from e

    if data.get("code") != "Ok" or not data.get("routes"):
        raise RoutingError(f"OSRM returned no routes: {data.get('code')}")

    routes = []
    for r in data["routes"]:
        # OSRM geometry is [lng, lat] — convert to [lat, lng] for Leaflet
        geometry = [
            [coord[1], coord[0]]
            for coord in r["geometry"]["coordinates"]
        ]
        routes.append(Route(
            geometry=geometry,
            distance_m=r["distance"],
            duration_s=r["duration"],
        ))
    return routes


async def hospital_durations(origin: Coord, hospitals: list[Coord]) -> list[float | None]:
    """Return one-to-many driving durations (seconds) from origin to each hospital.

    Uses the OSRM Table service in a single request — far cheaper than N route calls.
    Returns None for any hospital OSRM cannot reach.
    """
    coords = f"{origin.lng},{origin.lat};" + ";".join(
        f"{h.lng},{h.lat}" for h in hospitals
    )
    url = f"{OSRM_TABLE}/{coords}?sources=0&annotations=duration"

    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            data = resp.json()
    except (httpx.TimeoutException, httpx.ConnectError) as e:
        print(f"[ROUTING] OSRM Table unreachable ({e}), using haversine fallback")
        return [_haversine_m(origin, h) / (30_000 / 3600) for h in hospitals]
    except httpx.HTTPError as e:
        raise RoutingError(f"OSRM Table HTTP error: {e}") from e

    if data.get("code") != "Ok":
        raise RoutingError(f"OSRM Table error: {data.get('code')}")

    # durations[0] = [origin→origin=0, origin→h0, origin→h1, ...]
    row = data["durations"][0]
    return [row[i + 1] for i in range(len(hospitals))]  # skip self (index 0)
