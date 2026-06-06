import json
from pathlib import Path

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.staticfiles import StaticFiles

from models import DispatchRequest, DispatchResponse, Coord
from registry import registry
from routing import get_candidate_routes, hospital_durations, RoutingError
from ai_layer import choose_route, choose_hospital_route, NoRouteAvailable
from hospitals import find_nearby_hospitals, HospitalError
from traffic import incident_store

BASE_DIR = Path(__file__).parent
FRONTEND_DIR = BASE_DIR.parent / "frontend"

with open(BASE_DIR / "ambulances.json") as f:
    _ambulances_data = json.load(f)

KNOWN_IDS: set[str] = {a["id"] for a in _ambulances_data["ambulances"]}

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
    if not conn or not conn.last_position:
        raise HTTPException(
            status_code=409,
            detail={"status": "unavailable", "reason": "ambulance not connected"},
        )

    origin = Coord(lat=conn.last_position["lat"], lng=conn.last_position["lng"])

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

    await registry.push_to_ambulance(payload.ambulance_id, route_msg)
    await registry.broadcast_to_dispatch(route_msg)

    return DispatchResponse(
        status="dispatched",
        ambulance_id=payload.ambulance_id,
        duration_s=route.duration_s,
        distance_m=route.distance_m,
    )


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


# ── Hospital pipeline ─────────────────────────────────────────────────────────

async def _run_hospital_pipeline(ambulance_id: str) -> dict:
    """Full pickup→hospital pipeline. Returns the hospital_route payload dict."""
    conn = registry.get(ambulance_id)
    if not conn or not conn.last_position:
        return {"type": "error", "code": "no_gps", "message": "No GPS position — cannot compute hospital route"}

    pos = conn.last_position
    origin = Coord(lat=pos["lat"], lng=pos["lng"])

    # 1. Find nearby hospitals
    try:
        hospitals = await find_nearby_hospitals(origin)
    except HospitalError as e:
        return {"type": "error", "code": "hospital_error", "message": str(e)}

    if not hospitals:
        return {"type": "error", "code": "no_hospitals", "message": "No hospitals found within search radius"}

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

app.mount("/dispatch",  StaticFiles(directory=str(FRONTEND_DIR / "dispatch"),  html=True), name="dispatch")
app.mount("/ambulance", StaticFiles(directory=str(FRONTEND_DIR / "ambulance"), html=True), name="ambulance")
app.mount("/shared",    StaticFiles(directory=str(FRONTEND_DIR / "shared")),               name="shared")
