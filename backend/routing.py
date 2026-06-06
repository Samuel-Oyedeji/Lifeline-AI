import httpx
from models import Coord, Route


OSRM_BASE  = "https://router.project-osrm.org/route/v1/driving"
OSRM_TABLE = "https://router.project-osrm.org/table/v1/driving"
TIMEOUT = 8.0


class RoutingError(Exception):
    pass


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
    except httpx.TimeoutException as e:
        raise RoutingError("OSRM request timed out") from e
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
    except httpx.TimeoutException as e:
        raise RoutingError("OSRM Table request timed out") from e
    except httpx.HTTPError as e:
        raise RoutingError(f"OSRM Table HTTP error: {e}") from e

    if data.get("code") != "Ok":
        raise RoutingError(f"OSRM Table error: {data.get('code')}")

    # durations[0] = [origin→origin=0, origin→h0, origin→h1, ...]
    row = data["durations"][0]
    return [row[i + 1] for i in range(len(hospitals))]  # skip self (index 0)
