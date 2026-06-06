import asyncio
import json
import math
from pathlib import Path

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.staticfiles import StaticFiles

from models import DispatchRequest, DispatchResponse, Coord, Hospital
from registry import registry
from routing import get_candidate_routes, hospital_durations, RoutingError
from ai_layer import choose_route, choose_hospital_route, NoRouteAvailable
from traffic import incident_store

BASE_DIR = Path(__file__).parent
FRONTEND_DIR = BASE_DIR.parent / "frontend"

with open(BASE_DIR / "ambulances.json") as f:
    _ambulances_data = json.load(f)

KNOWN_IDS: set[str] = {a["id"] for a in _ambulances_data["ambulances"]}

# Load the same hospital dataset that the frontend map displays.
# This replaces live Overpass queries — same data, zero network dependency.
_HOSP_JSON = FRONTEND_DIR / "public" / "nigeria_hospitals.json"
with open(_HOSP_JSON) as f:
    _local_hospitals: list[dict] = json.load(f)["hospitals"]


def _find_hospitals_local(origin: Coord, limit: int = 20) -> list[Hospital]:
    """Return the `limit` closest hospitals to `origin` using haversine distance.

    Uses the bundled nigeria_hospitals.json — identical to what the driver map shows.
    """
    def _hav(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
        R = 6_371_000
        dlat = math.radians(lat2 - lat1)
        dlng = math.radians(lng2 - lng1)
        a = (math.sin(dlat / 2) ** 2
             + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2))
             * math.sin(dlng / 2) ** 2)
        return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    ranked = sorted(
        _local_hospitals,
        key=lambda h: _hav(origin.lat, origin.lng, h["lat"], h["lng"]),
    )
    return [
        Hospital(id=str(h["id"]), name=h["name"], lat=h["lat"], lng=h["lng"])
        for h in ranked[:limit]
    ]


# Seed incidents from file
with open(BASE_DIR / "mock_incidents.json") as f:
    for _inc in json.load(f)["incidents"]:
        incident_store.add(_inc)

app = FastAPI(title="Ambulance Dispatch")


# ── HTTP endpoints ────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {"status": "ok"}


@app.get("/ambulances")
async def list_ambulances():
    return _ambulances_data


@app.post("/dispatch", response_model=DispatchResponse)
async def dispatch(payload: DispatchRequest):
    conn = registry.get(payload.ambulance_id)

    # Determine ambulance origin: prefer live GPS → fallback to request-provided coords
    if conn and conn.last_position:
        origin = Coord(lat=conn.last_position["lat"], lng=conn.last_position["lng"])
    elif payload.ambulance_position:
        origin = payload.ambulance_position
    else:
        raise HTTPException(
            status_code=409,
            detail={"status": "unavailable", "reason": "ambulance not connected — open the driver page first"},
        )

    try:
        candidates = await get_candidate_routes(origin, payload.pickup)
    except RoutingError as e:
        raise HTTPException(status_code=502, detail=str(e))

    try:
        route = choose_route(candidates, context={})
    except NoRouteAvailable as e:
        raise HTTPException(status_code=502, detail=str(e))

    route_msg = {
        "type": "route",
        "ambulance_id": payload.ambulance_id,
        "geometry": route.geometry,
        "distance_m": route.distance_m,
        "duration_s": route.duration_s,
        "pickup": {"lat": payload.pickup.lat, "lng": payload.pickup.lng},
    }

    if conn:  # only push to ambulance device if it's actually connected
        await registry.push_to_ambulance(payload.ambulance_id, route_msg)
    await registry.broadcast_to_dispatch(route_msg)

    # Fire-and-forget: pre-compute hospital routes from the pickup location so
    # the driver sees all 3 routes immediately without waiting for pickup_complete.
    asyncio.create_task(
        _run_pre_hospital_pipeline(payload.ambulance_id, origin, payload.pickup)
    )

    return DispatchResponse(
        status="dispatched",
        ambulance_id=payload.ambulance_id,
        duration_s=route.duration_s,
        distance_m=route.distance_m,
    )


# ── Pre-hospital pipeline (triggered at dispatch time) ───────────────────────

async def _run_pre_hospital_pipeline(
    ambulance_id: str,
    ambulance_origin: Coord,
    pickup: Coord,
) -> None:
    """Compute pickup→hospital and ambulance→hospital routes at dispatch time.

    Sends a 'pre_hospital_routes' WS message so the driver sees all 3 routes
    on the map before even reaching the patient.
    """
    print(f"[PRE-HOSP] {ambulance_id} — computing hospital routes from pickup")
    try:
        # 1. Find hospitals near the PICKUP point from local dataset
        hospitals = _find_hospitals_local(pickup)
        if not hospitals:
            print(f"[PRE-HOSP] No hospitals found near pickup")
            return

        # 2. Rank cheaply with OSRM Table
        hospital_coords = [Coord(lat=h.lat, lng=h.lng) for h in hospitals]
        try:
            durations = await hospital_durations(pickup, hospital_coords)
        except RoutingError as e:
            print(f"[PRE-HOSP] RoutingError (table): {e}")
            return

        paired = [(h, d) for h, d in zip(hospitals, durations) if d is not None]
        paired.sort(key=lambda x: x[1])
        top3 = [h for h, _ in paired[:3]]

        # 3. Full candidate routes pickup → each finalist
        finalists_data = []
        for h in top3:
            try:
                routes = await get_candidate_routes(pickup, Coord(lat=h.lat, lng=h.lng))
                if routes:
                    finalists_data.append({"hospital": h, "routes": routes})
            except RoutingError:
                pass

        if not finalists_data:
            print(f"[PRE-HOSP] No routes to any hospital")
            return

        # 4. AI picks the best hospital + route
        try:
            decision = choose_hospital_route(finalists_data, incident_store, context={})
        except NoRouteAvailable as e:
            print(f"[PRE-HOSP] NoRouteAvailable: {e}")
            return

        hospital          = decision["hospital"]
        pickup_to_hosp    = decision["route"]
        effective_dur     = decision["effective_duration_s"]

        # 5. Also compute ambulance → hospital (direct route)
        amb_to_hosp_data = None
        try:
            amb_routes = await get_candidate_routes(
                ambulance_origin, Coord(lat=hospital.lat, lng=hospital.lng)
            )
            if amb_routes:
                best_amb = choose_route(amb_routes, context={})
                amb_to_hosp_data = {
                    "geometry": best_amb.geometry,
                    "distance_m": best_amb.distance_m,
                    "duration_s": best_amb.duration_s,
                }
        except (RoutingError, NoRouteAvailable):
            pass  # optional route — skip on failure

        payload = {
            "type": "pre_hospital_routes",
            "ambulance_id": ambulance_id,
            "hospital": {
                "name": hospital.name,
                "lat": hospital.lat,
                "lng": hospital.lng,
            },
            "pickup_to_hospital": {
                "geometry": pickup_to_hosp.geometry,
                "distance_m": pickup_to_hosp.distance_m,
                "duration_s": pickup_to_hosp.duration_s,
                "effective_duration_s": effective_dur,
            },
            "ambulance_to_hospital": amb_to_hosp_data,
        }

        print(f"[PRE-HOSP] {ambulance_id} → {hospital.name} ready, pushing routes")
        await registry.push_to_ambulance(ambulance_id, payload)
        await registry.broadcast_to_dispatch(payload)

    except Exception as e:
        print(f"[PRE-HOSP] Unexpected error for {ambulance_id}: {e}")


# ── Mock incident CRUD ────────────────────────────────────────────────────────

@app.get("/mock/incidents")
async def list_incidents():
    return {"incidents": [i.model_dump() for i in incident_store.all()]}


@app.post("/mock/incidents", status_code=201)
async def add_incident(body: dict):
    required = {"type", "lat", "lng", "radius_m", "delay_min"}
    missing = required - body.keys()
    if missing:
        raise HTTPException(status_code=422, detail=f"Missing fields: {missing}")
    if body["type"] not in ("congestion", "blockage"):
        raise HTTPException(status_code=422, detail="type must be 'congestion' or 'blockage'")
    incident = incident_store.add(body)
    return incident.model_dump()


@app.delete("/mock/incidents/{inc_id}")
async def delete_incident(inc_id: str):
    if not incident_store.remove(inc_id):
        raise HTTPException(status_code=404, detail="Incident not found")
    return {"status": "deleted", "id": inc_id}


@app.delete("/mock/incidents")
async def clear_incidents():
    incident_store.clear()
    return {"status": "cleared"}


# ── Hospital pipeline HTTP trigger (dispatch console) ────────────────────────

@app.post("/api/trigger-hospital/{ambulance_id}")
async def trigger_hospital(ambulance_id: str):
    """Allow the dispatch console to start the hospital pipeline without the ambulance device."""
    if ambulance_id not in KNOWN_IDS:
        raise HTTPException(status_code=404, detail="Unknown ambulance id")
    payload = await _run_hospital_pipeline(ambulance_id)
    await registry.push_to_ambulance(ambulance_id, payload)
    if payload.get("type") == "hospital_route":
        await registry.broadcast_to_dispatch(payload)
    if payload.get("type") == "error":
        raise HTTPException(status_code=409, detail=payload["message"])
    return payload


# ── Hospital pipeline ─────────────────────────────────────────────────────────

async def _run_hospital_pipeline(ambulance_id: str) -> dict:
    """Full pickup→hospital pipeline. Returns the hospital_route payload dict."""
    conn = registry.get(ambulance_id)
    if not conn or not conn.last_position:
        return {"type": "error", "code": "no_gps", "message": "No GPS position — cannot compute hospital route"}

    pos = conn.last_position
    origin = Coord(lat=pos["lat"], lng=pos["lng"])

    # 1. Find nearby hospitals from local dataset (same source as the driver map)
    hospitals = _find_hospitals_local(origin)
    if not hospitals:
        return {"type": "error", "code": "no_hospitals", "message": "No hospitals found in local dataset"}

    # 2. Rank hospitals cheaply with OSRM Table → top 3 finalists
    hospital_coords = [Coord(lat=h.lat, lng=h.lng) for h in hospitals]
    try:
        durations = await hospital_durations(origin, hospital_coords)
    except RoutingError as e:
        return {"type": "error", "code": "routing_error", "message": str(e)}

    paired = [
        (h, d) for h, d in zip(hospitals, durations)
        if d is not None
    ]
    paired.sort(key=lambda x: x[1])
    top3 = [h for h, _ in paired[:3]]
    print(f"[PIPELINE] {ambulance_id} → top 3 hospitals: {[h.name for h in top3]}")

    # 3. Fetch candidate routes for each finalist
    finalists_data = []
    for h in top3:
        try:
            routes = await get_candidate_routes(origin, Coord(lat=h.lat, lng=h.lng))
            if routes:
                finalists_data.append({"hospital": h, "routes": routes})
        except RoutingError:
            pass   # skip unreachable hospitals

    if not finalists_data:
        return {"type": "error", "code": "no_routes", "message": "Could not route to any nearby hospital"}

    # 4. Decision layer
    try:
        decision = choose_hospital_route(finalists_data, incident_store, context={})
    except NoRouteAvailable as e:
        return {"type": "error", "code": "no_routes", "message": str(e)}

    hospital = decision["hospital"]
    route    = decision["route"]

    return {
        "type": "hospital_route",
        "ambulance_id": ambulance_id,
        "destination": {"name": hospital.name, "lat": hospital.lat, "lng": hospital.lng},
        "geometry": route.geometry,
        "distance_m": route.distance_m,
        "duration_s": route.duration_s,
        "effective_duration_s": decision["effective_duration_s"],
        "alternatives": decision["alternatives"],
        "security_recommendation": decision["security_recommendation"],
    }


# ── WebSocket: ambulance ──────────────────────────────────────────────────────

@app.websocket("/ws/ambulance/{ambulance_id}")
async def ws_ambulance(websocket: WebSocket, ambulance_id: str):
    if ambulance_id not in KNOWN_IDS:
        await websocket.close(code=4004, reason="Unknown ambulance id")
        return

    await websocket.accept()
    await registry.register_ambulance(ambulance_id, websocket)
    print(f"[WS] Ambulance connected: {ambulance_id}")

    try:
        while True:
            data = await websocket.receive_json()

            if data.get("type") == "gps":
                gps = {
                    "lat": data["lat"],
                    "lng": data["lng"],
                    "heading": data.get("heading"),
                    "ts": data.get("ts"),
                }
                registry.update_position(ambulance_id, gps)
                print(f"[GPS] {ambulance_id} → {gps['lat']:.5f}, {gps['lng']:.5f}")

                await registry.broadcast_to_dispatch({
                    "type": "position",
                    "ambulance_id": ambulance_id,
                    "lat": gps["lat"],
                    "lng": gps["lng"],
                    "heading": gps["heading"],
                })

            elif data.get("type") == "pickup_complete":
                print(f"[PICKUP] {ambulance_id} — running hospital pipeline")
                payload = await _run_hospital_pipeline(ambulance_id)

                await registry.push_to_ambulance(ambulance_id, payload)

                if payload.get("type") == "hospital_route":
                    await registry.broadcast_to_dispatch(payload)

    except WebSocketDisconnect:
        pass
    except Exception as e:
        print(f"[WS] Error for {ambulance_id}: {e}")
    finally:
        await registry.unregister_ambulance(ambulance_id)
        print(f"[WS] Ambulance disconnected: {ambulance_id}")


# ── WebSocket: dispatch ───────────────────────────────────────────────────────

@app.websocket("/ws/dispatch")
async def ws_dispatch(websocket: WebSocket):
    await websocket.accept()
    await registry.add_dispatch_client(websocket)
    print("[WS] Dispatch client connected")

    await websocket.send_json({
        "type": "snapshot",
        "ambulances": registry.snapshot(),
    })

    # Also send current incident snapshot so dispatch map shows seeded incidents
    await websocket.send_json({
        "type": "incident_snapshot",
        "incidents": [i.model_dump() for i in incident_store.all()],
    })

    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    except Exception as e:
        print(f"[WS] Dispatch error: {e}")
    finally:
        await registry.remove_dispatch_client(websocket)
        print("[WS] Dispatch client disconnected")


# ── Static files ──────────────────────────────────────────────────────────────

# Driver device page (plain HTML, GPS streaming)
app.mount("/ambulance", StaticFiles(directory=str(FRONTEND_DIR / "ambulance"), html=True), name="ambulance")
app.mount("/shared",    StaticFiles(directory=str(FRONTEND_DIR / "shared")),               name="shared")

# React dispatch console (served last — catch-all at root)
_REACT_DIST = FRONTEND_DIR / "dist"
if _REACT_DIST.exists():
    app.mount("/", StaticFiles(directory=str(_REACT_DIST), html=True), name="spa")
