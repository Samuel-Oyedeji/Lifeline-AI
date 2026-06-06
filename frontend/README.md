# Ambulance Dispatch — Phase 1 + 2

Real-time ambulance dispatch with:
- **Flow #1** — fastest route from ambulance to patient pickup (Phase 1)
- **Flow #2** — best hospital after pickup, with incident-aware routing and security-detail recommendations (Phase 2)

---

## Prerequisites

- Python 3.11+
- Modern browser (Chrome/Firefox recommended for Geolocation API)

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

---

## Phase 1 demo — dispatch to pickup

1. Open an **ambulance tab** and grant location permission.
2. Open the **dispatch page** — the ambulance marker appears on the map.
3. Click the map to set a pickup point (📌 marker).
4. Select the ambulance, hit **Send Dispatch**.
5. The pickup route renders along real roads on both pages.

---

## Phase 2 demo — pickup to hospital

After the ambulance has the pickup route and is conceptually en route:

1. On the **ambulance page**, click **"Patient Picked Up — Find Hospital"**.
   - The backend queries OpenStreetMap for nearby hospitals, ranks them by OSRM driving time, runs the decision layer, and pushes back the best hospital route.
   - The route renders in green on both pages, with a destination 🏥 marker.
2. **ETA banner** shows effective time (raw + any incident delay).
3. **Security banner** appears if a clearable congestion on the chosen route would save ≥ 5 minutes.

### Staging incidents to see the decision change

On the dispatch page, use the **Mock Incidents** panel:

| Scenario | How to stage |
|----------|-------------|
| Security recommended | Place a **Congestion** incident (+20 min) on the route to the nearest hospital. Re-press "Patient Picked Up" on the ambulance page — the security banner should appear. |
| Reroute around blockage | Clear the congestion, place a **Blockage** (+45 min) on the same spot. Re-press — the decision layer picks the hospital with the lowest *effective* time and shows no security recommendation. |
| Back to normal | Clear all incidents, re-press — fastest hospital wins, no banners. |

`SECURITY_MIN_SAVINGS_S = 300` (5 min) in [ai_layer.py](backend/ai_layer.py) — lower it to see the banner trigger on smaller delays.

---

## Simulating multiple ambulances

Open the ambulance page in multiple tabs:

```
http://localhost:8000/ambulance/?id=AMB-001
http://localhost:8000/ambulance/?id=AMB-002
http://localhost:8000/ambulance/?id=AMB-003
```

Each tab streams independent GPS and receives its own route.

---

## Geolocation note

`navigator.geolocation` requires a **secure context**: `https://` or `http://localhost`.
Accessing via a LAN IP (e.g. `192.168.x.x`) silently fails to get GPS.

For LAN / mobile testing, use a tunnel:

```bash
# ngrok
ngrok http 8000

# mkcert
mkcert -install && mkcert localhost
uvicorn main:app --ssl-keyfile localhost-key.pem --ssl-certfile localhost.pem --port 8443
```

---

## API reference

### Phase 1

| Method | Path | Description |
|--------|------|-------------|
| `GET`  | `/health` | Health check |
| `GET`  | `/ambulances` | List known ambulance IDs |
| `POST` | `/dispatch` | Compute + push pickup route |

### Phase 2

| Method | Path | Description |
|--------|------|-------------|
| `GET`    | `/mock/incidents` | List all active incidents |
| `POST`   | `/mock/incidents` | Add an incident |
| `DELETE` | `/mock/incidents/{id}` | Remove one incident |
| `DELETE` | `/mock/incidents` | Clear all incidents |

Ambulance WebSocket messages (send):
- `{type:"gps", lat, lng, heading, ts}` — GPS position update
- `{type:"pickup_complete", ts}` — trigger hospital pipeline

---

## Architecture

```
browser (ambulance)              browser (dispatch)
      │  ws /ws/ambulance/{id}         │  ws /ws/dispatch
      │                                │
      └──────────── FastAPI ───────────┘
                    │
           routing.py   → OSRM demo (route + table)
           hospitals.py → Overpass API (OSM hospital data)
           traffic.py   → MockIncidentStore (injectable)
           ai_layer.py  → choose_route + choose_hospital_route
           registry.py  → in-memory connection state
```

---

## Phase 3 / next steps (not built)

| Item | Notes |
|------|-------|
| **Real traffic feed** | Replace `MockIncidentStore` with a live provider behind the same interface |
| **Hospital capacity/specialty** | Filter and weight by available ER beds and trauma level before travel-time ranking |
| **Auto-recompute on deviation** | Detect ambulance going off-route and re-trigger the pipeline |
| **Actual security dispatch** | The "Request Security" button is a stub seam; wire it to a real dispatch service |
| **Route recomputation (live incidents)** | Re-run pipeline when a new incident lands on an active route |
| **Auth + persistent DB** | JSON config and in-memory state are placeholders |
| **Multi-server scaling** | Single process; add Redis pub-sub for horizontal scaling |
| **OSRM self-hosted** | Demo server is rate-limited; self-hosted OSRM or Valhalla for production |
