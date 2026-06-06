# Ambulance Dispatch — Phase 1 + 2

Predictive emergency routing & hospital intelligence for Nigerian cities.
LifeLine AI doesn't just find the fastest route it **predicts future congestion**
and intelligently routes patients to the **best available hospital**.

Built as a dark, glassmorphic, neon-accented operator console — a mix of
**Uber + Google Maps + a medical dashboard**.

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

1. **Create a bucket** (globally-unique name), e.g. `lifeline-ai-demo`.
2. **Enable static website hosting**
   - S3 → your bucket → *Properties* → *Static website hosting* → **Enable**
   - Index document: `index.html`
   - Error document: `index.html` (HashRouter handles routing client-side)
3. **Upload the build**

   ```bash
   npm run build
   aws s3 sync dist/ s3://lifeline-ai-demo --delete
   ```

   …or just drag the **contents of `dist/`** into the bucket via the console.
4. **Make it public** 
   - *Permissions* → uncheck *Block all public access*
   - Add this bucket policy (replace the bucket name):

   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Sid": "PublicRead",
         "Effect": "Allow",
         "Principal": "*",
         "Action": "s3:GetObject",
         "Resource": "arn:aws:s3:::lifeline-ai-demo/*"
       }
     ]
   }
   ```
5. Open the **bucket website endpoint** URL. Done. 🎉

> **Nicer URLs + HTTPS (optional):** put **CloudFront** in front of the bucket
> and point your domain at it. Set the default root object to `index.html`.

---

## 🎨 Design system

Tokens are defined as CSS variables in [`src/index.css`](src/index.css):
`--bg`, `--primary`, `--secondary`, `--success`, `--warning`, `--critical`, etc.
Change them in one place to re-theme the whole app.
