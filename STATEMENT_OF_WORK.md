# STATEMENT OF WORK (SOW)
## Lifeline AI — Predictive Emergency Routing & Hospital Intelligence Platform

**Project Name:** Lifeline AI
**Project Type:** Real-time Emergency Response & Logistics
**Status:** Active Development (Phase 1 & 2 Complete, Phase 3 Planned)
**Document Version:** 1.1
**Last Updated:** June 2026

---

## 1. EXECUTIVE SUMMARY

Lifeline AI is a predictive emergency routing and hospital intelligence platform designed to optimize ambulance dispatch and patient routing in Nigerian urban centers (initial deployment: Lagos). The system reduces response times by computing real-time optimal routes from ambulance positions to patient locations, then intelligently recommends the best-equipped hospital based on travel time, incident congestion, and security considerations.

**Key Value Proposition:**
- Real-time GPS-based ambulance tracking and dispatch over WebSocket
- AI decision layer that selects the best hospital using *effective* travel time (raw OSRM time + live incident delays)
- Security-aware routing: flags when clearable congestion on the chosen route can be cleared by security intervention
- Multi-unit coordination across a 6-ambulance Lagos fleet with full dispatch-center visibility
- Glassmorphic, intuitive operator console UI optimized for high-stress environments

**Expected Impact:** Reduced patient transport time, improved hospital-selection decisions, enhanced situational awareness for emergency coordinators, and data-driven security recommendations during critical incidents.

---

## 2. PROJECT OVERVIEW

### 2.1 Project Vision
To save lives by drastically reducing ambulance response time and optimizing the journey to the best available hospital, using AI-driven routing that factors in real-time traffic, security risks, and hospital proximity.

### 2.2 Problem Statement
**Current State:**
- Emergency responders lack real-time visibility of ambulance positions and optimal routing
- Hospital selection is often ad-hoc, not data-driven
- Traffic congestion and security incidents are not factored into dispatch decisions
- No automated mechanism to recommend route changes or security escalations
- Dispatch teams operate without integrated decision-support tools

**Desired State:**
- Automated, real-time dispatch with optimal route calculation
- AI-powered hospital selection based on multiple factors
- Dynamic, incident-aware rerouting
- Security recommendations integrated into the dispatch workflow
- Unified dashboard for dispatch center operators and ambulance crews

### 2.3 Stakeholders
- **Primary Users:** Ambulance crews, dispatch center operators, emergency coordinators
- **Secondary Stakeholders:** Hospital ER management, security services, health ministry officials
- **Technical Stakeholders:** Backend & frontend developers, DevOps, QA
- **Business Stakeholders:** Emergency response agencies, healthcare providers, project sponsors

### 2.4 Scope
**In Scope:**
- Real-time GPS-based ambulance tracking (WebSocket)
- Optimal route computation from ambulance → patient pickup (OSRM)
- Hospital discovery and ranking (OSRM Table + candidate routes)
- AI decision layer for incident-aware hospital/route selection
- Dispatch center web console (React 18 + Vite)
- Ambulance unit driver page (plain HTML/JS, GPS streaming)
- Mock incident simulator for testing (congestion / blockage)
- Multi-unit coordination (6-ambulance fleet)

**Out of Scope (current phases):**
- Hospital capacity/bed management integration (Phase 3)
- Integration with real police/security dispatch APIs (Phase 3)
- Billing or financial module
- Patient medical record system
- Real-time traffic feed integration (Phase 3)
- Persistent database / authentication (Phase 3)

---

## 3. BUSINESS CASE

### 3.1 Problem Impact
- **Average Response Time:** Delayed dispatch due to manual routing increases time-to-care
- **Suboptimal Hospital Selection:** Wrong hospital choice extends total patient transport time
- **Operational Inefficiency:** Dispatch teams lack integrated decision-support
- **Safety Risk:** Security incidents not factored into route decisions

### 3.2 Proposed Solution Benefits
| Benefit | Impact | Measurable Outcome |
|---------|--------|-------------------|
| **Reduced Response Time** | Faster route calculation and real-time updates | 15–25% reduction in ambulance-to-patient time |
| **Better Hospital Routing** | AI considers traffic, incident data, proximity | 10–20% reduction in patient-to-hospital time |
| **Improved Operator Efficiency** | Single integrated dashboard replaces manual processes | 30% reduction in dispatch coordination time |
| **Enhanced Safety** | Proactive security recommendations | Real-time visibility of hazards; incident-aware routing |
| **Data-Driven Operations** | Logged incidents and routing decisions | Post-incident analysis and continuous improvement |

### 3.3 Success Metrics
- System uptime: ≥ 99% (production target)
- Route calculation latency: < 2 seconds
- Hospital ranking accuracy: > 90% (comparison to manual selection)
- Dispatch center adoption: 100% of coordinating staff trained
- Real-time tracking accuracy: ± 5 meters (GPS-dependent)
- Security recommendation accuracy: > 85% (false-positive rate < 10%)

---

## 4. HIGH-LEVEL TECHNICAL ARCHITECTURE

### 4.1 System Architecture Overview
```
┌─────────────────────────────────────────────────────────────────┐
│                     LIFELINE AI PLATFORM                          │
└─────────────────────────────────────────────────────────────────┘

┌──────────────────┐              ┌──────────────────┐
│  Ambulance Unit  │              │  Dispatch        │
│  (plain HTML/JS) │◄─WebSocket─► │  Console (React) │
│  /ambulance      │              │  /  (SPA)        │
└──────────────────┘              └──────────────────┘
        ▲                                ▲
        │      WS + HTTP (REST)          │
        └────────────┬───────────────────┘
                     │
              ┌──────▼──────┐
              │  FastAPI    │
              │  Backend    │  (Uvicorn ASGI)
              │  + Registry │
              └──────┬──────┘
                     │  httpx (async)
        ┌────────────┼─────────────────────┐
        │            │                      │
    ┌───▼──┐   ┌─────▼──────┐      ┌────────▼────────┐
    │OSRM  │   │ Overpass   │      │ Incident Store  │
    │route │   │ API (OSM)  │      │ (in-memory mock)│
    │+table│   │ hospitals  │      │ congestion/block│
    └──────┘   └────────────┘      └─────────────────┘
```

### 4.2 Core Components

#### **Frontend Layer**
- **Dispatch Console:** React 18 + Vite single-page app (react-router-dom, react-leaflet/Leaflet maps, framer-motion animations, lucide-react icons) with real-time map visualization, incident management, and dispatch controls. Built to `frontend/dist/` and served by FastAPI at `/`.
- **Ambulance Unit (Driver) Interface:** Lightweight, dependency-free **plain HTML/JS** page (`frontend/ambulance/`) for ambulance crews — GPS streaming, route display, and patient-pickup confirmation. Kept framework-free intentionally so it loads fast on low-end in-vehicle devices. Served by FastAPI at `/ambulance`.
- **Communication:** Native WebSocket for real-time, bi-directional message exchange with the backend.
- **Styling:** Hand-written CSS3 — glassmorphic dark theme with neon accents (no CSS framework).

#### **Backend Layer (FastAPI)**
- **WebSocket Handlers:** `/ws/ambulance/{id}` and `/ws/dispatch` manage real-time connections for ambulance units and dispatch console.
- **Dispatch Engine (`routing.py`):** Fetches candidate routes from OSRM (`get_candidate_routes`) and the hospital duration matrix (`hospital_durations`).
- **AI Decision Layer (`ai_layer.py`):** `choose_route` (fastest candidate) and `choose_hospital_route` (best hospital by *effective* time + security recommendation).
- **Registry (`registry.py`):** Tracks active ambulance connections, last GPS position, and dispatch clients; broadcasts updates.
- **Hospital Pipeline (`_run_hospital_pipeline` in `main.py`):** Discover → rank (top 3) → route → decide.
- **API Endpoints:** Health, ambulance list, dispatch, hospital trigger, incident CRUD.

#### **Data Services**
- **OSRM (Open Source Routing Machine):** Third-party demo service for route computation (`/route`) and travel-time matrix (`/table`).
- **OpenStreetMap + Overpass API:** Hospital discovery (`find_nearby_hospitals` in `hospitals.py`).
- **Incident Store (`traffic.py`):** In-memory mock incident store, seeded at startup from `mock_incidents.json` (Phase 1–2); real feed in Phase 3.
- **Ambulance Registry:** In-memory connection state + last GPS position; static fleet metadata loaded from `ambulances.json` (6 units).
- **Hospital reference data:** `backend/nigeriahealthfacilities.json` (backend), `frontend/public/lagos_hospitals.json` (frontend display).

#### **External Integrations**
- **OSRM Demo Server:** Route planning and travel-time calculations (called via `httpx`).
- **Overpass API:** Hospital data queries via OpenStreetMap (called via `httpx`).
- **Browser Geolocation API:** GPS streaming from the ambulance driver page.

### 4.3 Data Flow

**Flow #1: Dispatch to Pickup**
1. Ambulance driver page streams GPS via WebSocket (`type: "gps"`).
2. Registry updates last position; backend broadcasts `position` to dispatch.
3. Dispatch operator clicks map → sets pickup → selects unit → `POST /dispatch`.
4. Backend resolves origin (live GPS, else `ambulance_position` fallback), calls OSRM for candidate routes.
5. `choose_route()` picks the fastest candidate.
6. Backend pushes `route` message to the ambulance and broadcasts to dispatch.

**Flow #2: Pickup to Hospital**
1. Ambulance crew taps "Patient Picked Up" → `type: "pickup_complete"` (or dispatch triggers `POST /api/trigger-hospital/{id}`).
2. Backend queries nearby hospitals (Overpass API).
3. Ranks them cheaply via OSRM Table → top 3 finalists.
4. Fetches candidate routes to each finalist (OSRM).
5. `choose_hospital_route()` scores every (hospital, route) by **effective** time = raw duration + on-route incident delays; picks the minimum.
6. Builds a security recommendation: recommended **only** if clearable congestion on the chosen route saves ≥ 5 min (300 s); blockages are flagged as non-clearable.
7. Pushes `hospital_route` to ambulance + dispatch with destination, route, alternatives, and the recommendation.

### 4.4 Technology Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| **Backend** | FastAPI (Python 3.11+) on Uvicorn | Async, native WebSocket support, rapid development |
| **HTTP Client** | httpx (async) | Single async client for OSRM + Overpass calls |
| **Validation** | Pydantic | Request/response models, message schemas |
| **Dispatch Console** | React 18 + Vite | Fast HMR, modern component model |
| **Console libs** | react-router-dom, react-leaflet, framer-motion, lucide-react | Routing, maps, animation, icons |
| **Driver page** | Plain HTML + vanilla JS | Zero-dependency, fast on low-end in-vehicle devices |
| **Styling** | Hand-written CSS3 (glassmorphic) | No framework; full control of the dark/neon theme |
| **Mapping** | Leaflet + OSM tiles | Open-source, GPS-compatible, route rendering |
| **Routing** | OSRM Demo (`/route`, `/table`) | Open-source, no API key required for MVP |
| **Hospital data** | Overpass API + local JSON | Free OSM queries with a local reference fallback |
| **Hosting** | Cloud (AWS/GCP) or on-prem | TBD based on deployment requirements |

---

## 5. FUNCTIONAL REQUIREMENTS & TECHNICAL SPECIFICATIONS

### 5.1 Functional Requirements

#### **FR-1: Real-time Ambulance Tracking**
- Ambulance units stream GPS position at a configurable interval (1–5 seconds)
- Registry maintains live last-known position per unit
- Dispatch console displays ambulance markers in real-time (`position` broadcasts + initial `snapshot`)
- Accuracy: ± 5 meters (browser Geolocation API limitation)

#### **FR-2: Optimal Route Computation**
- System computes the fastest route from ambulance → patient pickup via OSRM
- Origin resolution: live GPS preferred, `ambulance_position` used as fallback if not yet streaming
- Latency target: < 2 seconds from request to route push
- Multiple candidate routes fetched; `choose_route()` selects the fastest

#### **FR-3: Hospital Discovery & Ranking**
- System queries nearby hospitals using Overpass/OSM data
- Cheap pre-rank via OSRM Table → top 3 finalists
- Candidate routes fetched per finalist; ranked by **effective** travel time
- Returns chosen hospital + alternatives (best effective time per other hospital)

#### **FR-4: Incident-Aware Routing**
- System tracks mock incidents: `congestion` (clearable) and `blockage` (not clearable)
- Each incident has a radius and a delay (minutes); on-route incidents add delay to effective time
- Effective time can make a farther hospital with a clear road beat a closer hospital behind a blockage

#### **FR-5: Security Recommendations**
- If clearable congestion on the chosen route saves ≥ 5 min (300 s), recommend security intervention
- Recommendation includes reason, incident type, estimated time saved, and incident location
- Blockages are explicitly flagged as non-clearable ("security cannot clear; rerouted to fastest available")

#### **FR-6: Multi-Unit Dispatch**
- Dispatch console coordinates the full 6-ambulance fleet simultaneously
- Each ambulance maintains independent route + connection state
- Real-time visibility of all unit positions and routes

#### **FR-7: Operator Console**
- Dispatch center staff can:
  - View all ambulance positions on the map
  - Click the map to set a pickup location
  - Select an ambulance and send a dispatch
  - Manage mock incidents (add / delete / clear)
  - Trigger the hospital pipeline directly (`/api/trigger-hospital/{id}`)
  - View active dispatch status, ETA, and security recommendations
  - Add patient notes to a dispatch request

#### **FR-8: Ambulance Unit Interface**
- Ambulance crew can:
  - Stream GPS and view the current route on the map
  - Confirm patient pickup (triggers the hospital pipeline)
  - View the recommended hospital + alternatives
  - See the security recommendation banner when applicable
  - See real-time ETA and effective travel time

### 5.2 Technical Specifications

#### **API Endpoints**

| Method | Endpoint | Request | Response | Status |
|--------|----------|---------|----------|--------|
| GET | `/health` | – | `{"status": "ok"}` | 200 |
| GET | `/ambulances` | – | `{"ambulances": [...]}` (6 units) | 200 |
| POST | `/dispatch` | `{ambulance_id, pickup, patient?, ambulance_position?}` | `{status, ambulance_id, duration_s, distance_m}` | 200 / 409 (not connected) / 502 (routing) |
| POST | `/api/trigger-hospital/{ambulance_id}` | – | `hospital_route` payload | 200 / 404 (unknown id) / 409 (pipeline error) |
| WS | `/ws/ambulance/{id}` | GPS / pickup events | `route` / `hospital_route` / `error` | 101 (4004 if unknown id) |
| WS | `/ws/dispatch` | – (listener) | `snapshot`, `incident_snapshot`, `position`, `route`, `hospital_route` | 101 |
| GET | `/mock/incidents` | – | `{"incidents": [...]}` | 200 |
| POST | `/mock/incidents` | `{type, lat, lng, radius_m, delay_min}` | Created incident | 201 / 422 (invalid) |
| DELETE | `/mock/incidents/{id}` | – | `{"status": "deleted", "id"}` | 200 / 404 |
| DELETE | `/mock/incidents` | – | `{"status": "cleared"}` | 200 |

> Note: `type` for an incident must be `"congestion"` or `"blockage"`. Unknown ambulance IDs on the WebSocket are closed with code `4004`.

#### **WebSocket Message Schemas**

**Ambulance → Backend (GPS Update):**
```json
{ "type": "gps", "lat": 6.5244, "lng": 3.3792, "heading": 45, "ts": 1686400000 }
```

**Ambulance → Backend (Pickup Confirmation):**
```json
{ "type": "pickup_complete" }
```

**Backend → Ambulance (Route Update):**
```json
{
  "type": "route",
  "ambulance_id": "LAG-A12",
  "geometry": [[6.5244, 3.3792], [6.5250, 3.3800]],
  "distance_m": 5642,
  "duration_s": 451,
  "pickup": { "lat": 6.5244, "lng": 3.3792 }
}
```

**Backend → Dispatch (Position Broadcast):**
```json
{ "type": "position", "ambulance_id": "LAG-A12", "lat": 6.5244, "lng": 3.3792, "heading": 45 }
```

**Backend → Dispatch (On Connect):**
```json
{ "type": "snapshot", "ambulances": [{ "ambulance_id": "LAG-A12", "lat": 6.52, "lng": 3.37 }] }
{ "type": "incident_snapshot", "incidents": [ /* current incidents */ ] }
```

**Backend → Ambulance + Dispatch (Hospital Recommendation):**
```json
{
  "type": "hospital_route",
  "ambulance_id": "LAG-A12",
  "destination": { "name": "Lagos Island General Hospital", "lat": 6.5265, "lng": 3.3715 },
  "geometry": [[6.5244, 3.3792], [6.5265, 3.3715]],
  "distance_m": 8520,
  "duration_s": 612,
  "effective_duration_s": 912,
  "alternatives": [
    { "name": "...", "lat": 6.53, "lng": 3.37, "duration_s": 700, "effective_duration_s": 700 }
  ],
  "security_recommendation": {
    "recommended": true,
    "reason": "clearable congestion on fastest route",
    "incident_type": "congestion",
    "estimated_time_saved_s": 300,
    "incident_location": { "lat": 6.5250, "lng": 3.3750 }
  }
}
```

**Backend → Ambulance (Pipeline Error):**
```json
{ "type": "error", "code": "no_gps", "message": "No GPS position — cannot compute hospital route" }
```

#### **Data Models**

**Ambulance (static metadata, `ambulances.json`):**
```python
{
  "id": "LAG-A12",
  "label": "Unit A12",
  "type": "Advanced Life Support" | "Basic Life Support",
  "crew": "Paramedic + EMT" | "EMT x2",
  "plate": "LND-238-AA"
}
# Runtime state in registry: last_position {lat, lng}, heading, connection status
```

**Incident (`models.Incident`):**
```python
{
  "id": "INC-001",
  "type": "congestion" | "blockage",   # congestion = clearable, blockage = not clearable
  "lat": float,
  "lng": float,
  "radius_m": float,
  "delay_min": float,                  # additional travel time in minutes
  "description": str
}
```

**Dispatch Request (`models.DispatchRequest`):**
```python
{
  "ambulance_id": "LAG-A12",
  "pickup": {"lat": float, "lng": float},
  "patient": {"name": str | None, "notes": str | None} | None,
  "ambulance_position": {"lat": float, "lng": float} | None   # fallback origin
}
```

#### **Performance Requirements**
- Route calculation: < 2000 ms
- WebSocket latency: < 100 ms
- Incident search/filtering: < 500 ms
- Hospital discovery query: < 1500 ms
- Concurrent users target: 50+ ambulances + 10+ dispatch stations (Phase 3 scale work)
- Uptime SLA: 99% (production)

#### **Security & Reliability (current vs. planned)**
- Ambulance WebSocket validated against known fleet IDs (unknown IDs closed with `4004`) — *implemented*
- HTTPS/WSS for encrypted transport — *planned (production)*
- Input validation on REST endpoints via Pydantic / explicit field checks — *implemented*
- Authentication (API key / JWT), rate limiting — *planned (Phase 3)*
- Graceful handling when OSRM/Overpass unavailable (typed errors → 502 / pipeline error payloads) — *implemented*
- Persistent audit log — *planned (Phase 3)*

---

## 6. PROJECT PHASES & DELIVERABLES

### Phase 1: Core Dispatch (✅ COMPLETE)
**Timeline:** Weeks 1–4
**Goals:**
- Ambulance GPS streaming to dispatch console
- Optimal route computation (ambulance → patient pickup)
- Real-time route visualization

**Deliverables:**
- FastAPI backend with WebSocket support (`/ws/ambulance/{id}`, `/ws/dispatch`)
- React dispatch console with map + ambulance markers
- Plain HTML/JS ambulance driver page with GPS streaming
- OSRM integration for route planning
- Mock fleet data (6 units)
- Documentation + demo walkthrough

**Key Features:**
- `POST /dispatch` endpoint for route computation (with GPS / `ambulance_position` fallback)
- `route` push to ambulance + dispatch broadcast
- Dispatch console UI: map click for pickup, unit selector, Send Dispatch

---

### Phase 2: Intelligent Hospital Selection (✅ COMPLETE)
**Timeline:** Weeks 5–8
**Goals:**
- Automated hospital discovery and ranking
- Incident-aware routing with security recommendations
- Multi-flow coordination (pickup → hospital)

**Deliverables:**
- Hospital discovery via Overpass API (`find_nearby_hospitals`)
- OSRM Table pre-rank → top 3 finalists → candidate routes
- AI decision layer (`choose_hospital_route`) using effective time
- Mock incident store + incident CRUD API + dispatch incident controls
- Effective-time calculation (raw + on-route incident delay)
- Security recommendation logic (≥ 5 min clearable savings)
- `POST /api/trigger-hospital/{id}` so dispatch can run the pipeline without the device

**Key Features:**
- "Patient Picked Up" trigger on ambulance UI → hospital pipeline
- Chosen hospital + alternatives with ETAs
- Incident staging controls on dispatch console
- Security recommendation banner

---

### Phase 3: Production Hardening & Scale (📋 PLANNED)
**Timeline:** Weeks 9–12
**Goals:**
- Real traffic feed integration
- Hospital capacity/specialty filtering
- Auto-recompute on deviation detection
- Actual security dispatch integration
- Authentication, rate limiting, persistence
- Load testing & production deployment

**Deliverables:**
- Real traffic provider integration (e.g., Google Maps, HERE, TomTom)
- Hospital capacity API integration
- Deviation detection (ambulance off-route)
- Auth (API key / JWT) + rate limiting + WSS
- Persistence layer (PostgreSQL audit log, Redis distributed cache/sessions)
- Load testing report (1000+ concurrent users)
- Production deployment guide + monitoring/alerting + support runbook

**Future Enhancements:**
- Push notifications for critical updates
- Historical analytics dashboard
- Predictive incident forecasting
- ML model for hospital selection (replacing the current heuristic)

---

## 7. SUCCESS CRITERIA

### 7.1 Functional Success
- [x] All Phase 1 features operational and tested
- [x] All Phase 2 features operational and tested
- [ ] Phase 3 features integrated and deployed
- [ ] Zero critical bugs in production
- [ ] All endpoints meet latency SLA (< 2s)
- [ ] WebSocket connections remain stable for 24+ hours

### 7.2 Operational Success
- [ ] Dispatch center staff trained on console (100% adoption)
- [ ] Ambulance crews trained on driver page
- [ ] 24/7 on-call support structure in place
- [ ] Incident response procedure documented
- [ ] Rollback procedure tested and verified

### 7.3 Business Success
- [ ] System reduces patient response time by 15–25%
- [ ] Hospital selection aligns with optimal routing 90%+ of the time
- [ ] Dispatch coordination time reduced by 30%
- [ ] Uptime ≥ 99% over a 30-day period
- [ ] Zero data loss or corrupted routes

### 7.4 Quality Success
- [ ] Unit test coverage: ≥ 80%
- [ ] Integration tests for all critical flows (dispatch, pickup → hospital, incident CRUD)
- [ ] Load testing: 100+ concurrent ambulances
- [ ] Security audit completed
- [ ] Performance benchmarks documented

---

## 8. RISK MANAGEMENT

### 8.1 Identified Risks

| # | Risk | Probability | Impact | Mitigation |
|---|------|-------------|--------|-----------|
| **R1** | External API unavailability (OSRM, Overpass) | Medium | High | Typed errors with 502 / graceful pipeline error payloads; local hospital JSON fallback; self-hosted OSRM in Phase 3 |
| **R2** | GPS accuracy / HTTPS requirement | Medium | Medium | Document geolocation constraints; provide HTTPS tunnel setup guide; test with mkcert |
| **R3** | WebSocket connection drops | Medium | High | Client auto-reconnect with backoff; registry cleanup on disconnect; snapshot resync on reconnect |
| **R4** | Concurrent user scaling (>100 ambulances) | Low | High | Load testing; Redis-backed distributed registry in Phase 3 |
| **R5** | Incident data inconsistency | Low | Medium | In-memory store with single-writer access; audit log in Phase 3 |
| **R6** | Hospital data stale or incomplete | Low | Medium | Refresh OSM data; validate coordinates; alert on zero hospitals found |
| **R7** | Unauthenticated access (no auth yet) | Medium | High | Phase 3: API key / JWT, WSS, input sanitization, rate limiting; restrict network exposure pre-Phase 3 |
| **R8** | Security-escalation misuse | Low | Medium | Confirmation dialog; log every request; cooldown; weekly audit |
| **R9** | Dispatch team unfamiliar with console | Medium | Medium | Hands-on training; in-app tooltips; quick-reference guide |
| **R10** | Phase 3 real traffic feed unavailable | Low | High | Keep mock incident system as fallback; circuit breaker on feed |

### 8.2 Risk Mitigation Strategies

**R1 (External API Failure):**
- Wrap OSRM/Overpass calls with timeouts and typed exceptions (`RoutingError`, `HospitalError`)
- Surface as `502` (dispatch) or structured `error` payloads (pipeline) instead of crashing
- Maintain local hospital reference JSON; plan self-hosted OSRM for production

**R2 (GPS Accuracy):**
- Document that browser geolocation requires HTTPS or localhost
- Provide a pre-configured ngrok/mkcert setup guide
- Show a GPS status indicator in the driver page

**R3 (WebSocket Drops):**
- Client-side auto-reconnect with exponential backoff
- Registry unregisters cleanly on disconnect; re-sends `snapshot` + `incident_snapshot` on reconnect
- Heartbeat/ping mechanism (Phase 3) to detect stale connections

**R4 (Scaling):**
- Load test with 100+ concurrent connections
- Move the in-memory registry to Redis for horizontal scaling (Phase 3)

**R5 (Incident Consistency):**
- Keep the incident store single-writer; validate inputs on create
- Add an immutable audit log in Phase 3

**R6 (Hospital Data):**
- Periodic Overpass refresh; validate hospital coordinates/names
- Alert if an OSM query returns zero hospitals; fall back to local JSON

**R7 (No Auth Yet):**
- Treat current builds as trusted-network/demo only
- Phase 3: API key / JWT on all endpoints, WSS-only, input sanitization, rate limiting (100 req/min/IP)

**R8 (Security Escalation Abuse):**
- "Are you sure?" confirmation before sending
- Log ambulance ID, timestamp, and location; per-unit cooldown; weekly audit

**R9 (Staff Unfamiliarity):**
- 2-hour hands-on training per team; video tutorial; in-app tooltips; first-week support

**R10 (Real Traffic Feed Failure):**
- Circuit breaker → fall back to mock incidents after repeated failures
- Keep the mock incident system as a permanent backup; test failover quarterly

---

## 9. ASSUMPTIONS & CONSTRAINTS

### 9.1 Assumptions
- Ambulances have modern browsers supporting WebSocket and Geolocation APIs
- Dispatch center has a stable internet connection (≥ 5 Mbps)
- OSRM demo and Overpass APIs remain free and accessible
- Hospital data in OpenStreetMap is reasonably accurate
- Ambulance crews receive basic training on the new system
- Security dispatch integration available by Phase 3

### 9.2 Constraints
- **Geolocation:** HTTPS or localhost only; LAN IPs require tunnel setup
- **State:** Current registry and incident store are **in-memory** (no persistence until Phase 3) — restart clears live state
- **Auth:** No authentication on REST endpoints yet (Phase 3)
- **Data:** Hospital data via Overpass + local JSON; real-time traffic feed in Phase 3
- **External Dependencies:** OSRM and Overpass availability not guaranteed in production
- **Mobile:** Driver page is responsive plain HTML; tested on mobile

---

## 10. COMPLIANCE & GOVERNANCE

### 10.1 Regulatory Considerations
- **Data Privacy:** Ensure patient data (if captured) complies with local regulations (e.g., NDPR in Nigeria)
- **Emergency Services:** Coordinate with emergency-service agencies on data sharing and escalation
- **Cybersecurity:** Implement OWASP Top 10 mitigations; regular penetration testing (Phase 3)

### 10.2 Change Management
- Changes to the routing/decision heuristics require sign-off from the AI review team
- Hospital and incident data changes logged and auditable (Phase 3 audit log)
- Breaking API changes require version increment and a deprecation period

### 10.3 Documentation
- Architecture diagrams (`ARCHITECTURE_DIAGRAMS.html`) updated alongside code changes
- API documentation kept in sync with code (FastAPI auto-generates OpenAPI/Swagger at `/docs`)
- Runbooks for common operations (incident staging, fleet reset, etc.)
- Post-incident reviews conducted within 48 hours

---

## 11. APPENDICES

### 11.1 Glossary
- **Ambulance Unit / Driver Page:** Plain HTML/JS page on the ambulance device; streams GPS, shows route and hospital recommendation
- **Dispatch Console:** React SPA for dispatch coordinators; shows all ambulances and allows dispatch
- **Incident:** `congestion` (clearable) or `blockage` (not clearable) affecting routing
- **Effective Time:** Raw OSRM duration + sum of on-route incident delays — the value the AI ranks on
- **OSRM:** Open Source Routing Machine (`/route` for paths, `/table` for the duration matrix)
- **Overpass API:** Query interface for OpenStreetMap data (hospital discovery)
- **Security Escalation:** Recommendation to clear congestion via security when it saves ≥ 5 min

### 11.2 Key Source Files
| File | Responsibility |
|------|----------------|
| `backend/main.py` | FastAPI app, endpoints, WebSocket handlers, hospital pipeline |
| `backend/routing.py` | OSRM candidate routes + duration matrix |
| `backend/ai_layer.py` | `choose_route`, `choose_hospital_route`, security logic |
| `backend/hospitals.py` | Overpass hospital discovery |
| `backend/traffic.py` | In-memory incident store, on-route incident detection |
| `backend/registry.py` | Ambulance/dispatch connection registry + broadcasts |
| `backend/models.py` | Pydantic models + WS message shapes |
| `frontend/src/` | React dispatch console (SPA) |
| `frontend/ambulance/` | Plain HTML/JS driver page |

### 11.3 References
- FastAPI Documentation: https://fastapi.tiangolo.com
- httpx: https://www.python-httpx.org
- OSRM API: https://router.project-osrm.org
- Overpass API: https://wiki.openstreetmap.org/wiki/Overpass_API
- OpenStreetMap: https://www.openstreetmap.org
- Leaflet Maps: https://leafletjs.com
- React Documentation: https://react.dev

### 11.4 Approval Sign-off

| Role | Name | Signature | Date |
|------|------|-----------|------|
| Project Manager | [Name] | __________ | ______ |
| Technical Lead | [Name] | __________ | ______ |
| Dispatch Manager | [Name] | __________ | ______ |
| Sponsor | [Name] | __________ | ______ |

---

**End of Statement of Work**
