# Ambulance Dispatch — Phase 1

A real-time ambulance dispatch system covering **Flow #1**: compute the fastest route from an ambulance's current GPS position to a pickup point, and push it to that unit over a WebSocket.

## Prerequisites

- Python 3.11+
- A modern browser (Chrome/Firefox recommended for Geolocation API)

## Install & run

```bash
cd ambulance-dispatch/backend
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

## URLs

| Page | URL |
|------|-----|
| Ambulance unit (AMB-001) | http://localhost:8000/ambulance/ |
| Ambulance unit (AMB-002) | http://localhost:8000/ambulance/?id=AMB-002 |
| Ambulance unit (AMB-003) | http://localhost:8000/ambulance/?id=AMB-003 |
| Dispatch centre | http://localhost:8000/dispatch/ |
| API health | http://localhost:8000/health |
| Ambulance list | http://localhost:8000/ambulances |

## Demo walkthrough

1. Open **one or more ambulance tabs** (use `?id=AMB-002`, `?id=AMB-003` to simulate multiple units). Grant location permission.
2. Open the **dispatch page** — ambulance markers appear on the map as GPS ticks arrive.
3. **Click the map** on the dispatch page to set a pickup point (📌 marker appears).
4. Select an ambulance from the dropdown, optionally add patient notes, then click **Send Dispatch**.
5. The route renders on **both** the dispatch map (colour-coded per unit) and the ambulance's own map, drawn along real roads.

## Simulating multiple ambulances

Open the ambulance page in multiple tabs with different `?id=` values:

```
http://localhost:8000/ambulance/?id=AMB-001
http://localhost:8000/ambulance/?id=AMB-002
http://localhost:8000/ambulance/?id=AMB-003
```

Each tab streams independent GPS from its browser.

## Geolocation note

`navigator.geolocation` only works in a **secure context**: `https://` or `http://localhost`.  
Accessing the ambulance page over a LAN IP (e.g. `192.168.x.x`) will silently fail to get GPS.

For LAN / mobile testing, use an HTTPS tunnel:

```bash
# Option A — ngrok
ngrok http 8000

# Option B — mkcert (local CA)
mkcert -install && mkcert localhost
uvicorn main:app --ssl-keyfile localhost-key.pem --ssl-certfile localhost.pem --port 8443
```

## API

### `POST /dispatch`

```json
{
  "ambulance_id": "AMB-001",
  "pickup": { "lat": 7.3775, "lng": 3.9470 },
  "patient": { "name": "optional", "notes": "optional" }
}
```

**200 OK:**
```json
{ "status": "dispatched", "ambulance_id": "AMB-001", "duration_s": 451, "distance_m": 5642 }
```

**409 Conflict** (ambulance not connected or has no GPS fix):
```json
{ "detail": { "status": "unavailable", "reason": "ambulance not connected" } }
```

## Architecture

```
browser (ambulance)          browser (dispatch)
      │  ws /ws/ambulance/{id}      │  ws /ws/dispatch
      │                             │
      └──────────── FastAPI ────────┘
                    │
           routing.py → OSRM demo server
           ai_layer.py (stub — picks fastest route)
           registry.py (in-memory connection state)
```

## Phase 2 / next steps

The following are intentionally stubbed or omitted in Phase 1:

| Item | Notes |
|------|-------|
| **AI layer** | `ai_layer.choose_route()` currently returns the fastest candidate. Swap in a real scorer (traffic, accident data) without changing the endpoint. |
| **Hospital routing (Flow #2)** | Pickup → nearest hospital, ranked by driving time not straight-line distance. |
| **Police / security-clearing** | Decision logic for route pre-clearance. |
| **Route recomputation** | Detect ambulance deviation and re-dispatch automatically. |
| **Persistent datastore** | Replace in-memory state with a database for trip records. |
| **Authentication** | JSON config login is a placeholder — no real auth. |
| **Multi-server scaling** | Single process only. Redis pub-sub needed for horizontal scaling. |
| **Rate limiting** | OSRM demo server is best-effort. A self-hosted OSRM or Valhalla instance is needed for production. |
