import json
import os
from pathlib import Path

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse

from models import DispatchRequest, DispatchResponse, Coord
from registry import registry
from routing import get_candidate_routes, RoutingError
from ai_layer import choose_route, NoRouteAvailable

BASE_DIR = Path(__file__).parent
FRONTEND_DIR = BASE_DIR.parent / "frontend"

with open(BASE_DIR / "ambulances.json") as f:
    _ambulances_data = json.load(f)

KNOWN_IDS: set[str] = {a["id"] for a in _ambulances_data["ambulances"]}

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

    origin = Coord(
        lat=conn.last_position["lat"],
        lng=conn.last_position["lng"],
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

    await registry.push_to_ambulance(payload.ambulance_id, route_msg)
    await registry.broadcast_to_dispatch(route_msg)

    return DispatchResponse(
        status="dispatched",
        ambulance_id=payload.ambulance_id,
        duration_s=route.duration_s,
        distance_m=route.distance_m,
    )


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

    try:
        while True:
            # Keep connection alive; dispatch clients are receive-only
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    except Exception as e:
        print(f"[WS] Dispatch error: {e}")
    finally:
        await registry.remove_dispatch_client(websocket)
        print("[WS] Dispatch client disconnected")


# ── Static files ──────────────────────────────────────────────────────────────

app.mount("/dispatch", StaticFiles(directory=str(FRONTEND_DIR / "dispatch"), html=True), name="dispatch")
app.mount("/ambulance", StaticFiles(directory=str(FRONTEND_DIR / "ambulance"), html=True), name="ambulance")
app.mount("/shared", StaticFiles(directory=str(FRONTEND_DIR / "shared")), name="shared")
