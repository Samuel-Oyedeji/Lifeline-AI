import asyncio
from dataclasses import dataclass, field
from typing import Optional
from fastapi import WebSocket


@dataclass
class AmbulanceConnection:
    websocket: WebSocket
    ambulance_id: str
    last_position: Optional[dict] = None   # {lat, lng, heading, ts}
    current_route: Optional[dict] = None


class ConnectionRegistry:
    def __init__(self):
        self._ambulances: dict[str, AmbulanceConnection] = {}
        self._dispatch_clients: set[WebSocket] = set()

    async def register_ambulance(self, ambulance_id: str, ws: WebSocket) -> None:
        self._ambulances[ambulance_id] = AmbulanceConnection(
            websocket=ws, ambulance_id=ambulance_id
        )

    async def unregister_ambulance(self, ambulance_id: str) -> None:
        self._ambulances.pop(ambulance_id, None)

    def update_position(self, ambulance_id: str, gps: dict) -> None:
        conn = self._ambulances.get(ambulance_id)
        if conn:
            conn.last_position = gps

    def get(self, ambulance_id: str) -> Optional[AmbulanceConnection]:
        return self._ambulances.get(ambulance_id)

    async def push_to_ambulance(self, ambulance_id: str, message: dict) -> bool:
        conn = self._ambulances.get(ambulance_id)
        if not conn:
            return False
        try:
            await conn.websocket.send_json(message)
            return True
        except Exception:
            await self.unregister_ambulance(ambulance_id)
            return False

    async def add_dispatch_client(self, ws: WebSocket) -> None:
        self._dispatch_clients.add(ws)

    async def remove_dispatch_client(self, ws: WebSocket) -> None:
        self._dispatch_clients.discard(ws)

    async def broadcast_to_dispatch(self, message: dict) -> None:
        dead: set[WebSocket] = set()
        for ws in self._dispatch_clients:
            try:
                await ws.send_json(message)
            except Exception:
                dead.add(ws)
        for ws in dead:
            self._dispatch_clients.discard(ws)

    def snapshot(self) -> list[dict]:
        result = []
        for conn in self._ambulances.values():
            if conn.last_position:
                result.append({
                    "ambulance_id": conn.ambulance_id,
                    "lat": conn.last_position["lat"],
                    "lng": conn.last_position["lng"],
                })
        return result


registry = ConnectionRegistry()
