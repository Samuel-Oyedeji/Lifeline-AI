# STATEMENT OF WORK (SOW)
## Lifeline AI — Predictive Emergency Routing & Hospital Intelligence Platform

**Project:** Lifeline AI &nbsp;|&nbsp; **Type:** Real-time Emergency Response & Logistics
**Status:** Phase 1 & 2 Complete, Phase 3 Planned &nbsp;|&nbsp; **Version:** 2.0 &nbsp;|&nbsp; **Updated:** June 2026

---

## 1. EXECUTIVE SUMMARY

Lifeline AI is a predictive emergency routing and hospital intelligence platform that optimizes ambulance dispatch and patient routing in Nigerian urban centers (initial deployment: Lagos). It cuts response times by computing real-time optimal routes from ambulance to patient, then recommending the best hospital using *effective* travel time — raw routing time plus live incident delays — and flags when a security intervention could clear congestion.

**Value proposition:**
- Real-time GPS ambulance tracking and dispatch over WebSocket
- AI hospital selection on effective travel time (routing + incident delays)
- Security-aware routing: recommends clearing congestion when it saves ≥ 5 min
- Multi-unit coordination across a 6-ambulance fleet with full dispatch visibility
- Glassmorphic operator console built for high-stress environments

**Expected impact:** lower patient transport time, better hospital decisions, and stronger situational awareness for coordinators.

---

## 2. PROJECT OVERVIEW

**Vision:** Save lives by reducing ambulance response time and optimizing the journey to the best hospital, factoring in real-time traffic, security risks, and proximity.

**Problem → Solution:**
- Responders lack live ambulance visibility and optimal routing → real-time tracking + automated route computation
- Hospital selection is ad-hoc → AI ranking by effective travel time
- Traffic/security incidents ignored in routing → incident-aware rerouting + security recommendations
- No integrated tooling → unified dispatch console + ambulance driver page

**Stakeholders:** ambulance crews, dispatch operators, emergency coordinators (primary); hospital ER, security services, health ministry (secondary); dev/QA/DevOps and sponsors (technical/business).

**In scope:** GPS tracking, route computation (OSRM), hospital discovery/ranking (Overpass + OSRM), AI decision layer, React dispatch console, plain-HTML ambulance driver page, mock incident simulator, 6-unit coordination.

**Out of scope (current phases):** hospital capacity/bed integration, real police/security dispatch APIs, billing, patient records, live traffic feed, persistence/auth — all targeted for Phase 3.

---

## 3. BUSINESS CASE

| Benefit | Driver | Target Outcome |
|---------|--------|----------------|
| Reduced response time | Faster routing + real-time updates | 15–25% less ambulance-to-patient time |
| Better hospital routing | AI weighs traffic, incidents, proximity | 10–20% less patient-to-hospital time |
| Operator efficiency | One integrated dashboard | 30% less coordination time |
| Enhanced safety | Proactive security recommendations | Incident-aware routing, hazard visibility |
| Data-driven ops | Logged incidents & decisions | Post-incident analysis |

**Success metrics:** uptime ≥ 99%, route latency < 2 s, hospital ranking accuracy > 90%, tracking ± 5 m, security recommendation accuracy > 85%.

---

## 4. HIGH-LEVEL TECHNICAL ARCHITECTURE

**Topology:** A React dispatch console and a plain HTML/JS ambulance driver page talk to a FastAPI backend over WebSocket (real-time) and REST. The backend keeps ambulance + incident state in memory and calls OSRM (routing) and Overpass (hospitals) via `httpx`.

**Deployment (target):** React/static frontend hosted on **AWS S3** (static website, optionally fronted by CloudFront); FastAPI backend on **AWS EC2** (Uvicorn). Browsers load the UI from S3 and connect to EC2 for REST + WebSocket; EC2 calls external OSRM/Overpass.

**Layers:**
- **Frontend:** Dispatch console — React 18 + Vite (react-router-dom, react-leaflet/Leaflet, framer-motion, lucide-react), hand-written CSS3. Ambulance driver page — dependency-free HTML/JS for fast load on in-vehicle devices.
- **Backend (FastAPI/Uvicorn):** WebSocket handlers (`/ws/ambulance/{id}`, `/ws/dispatch`); dispatch + hospital pipeline; AI decision layer (`choose_route`, `choose_hospital_route`); in-memory registry; incident store.
- **Data/External:** OSRM demo (`/route`, `/table`), Overpass API, browser Geolocation; seed data from `ambulances.json`, `mock_incidents.json`, `nigeriahealthfacilities.json`.

**Tech stack:** FastAPI + Uvicorn + Pydantic + httpx (Python 3.11+); React 18 + Vite + Leaflet (console); plain HTML/JS (driver); OSRM + Overpass (external); EC2 + S3 (hosting).

---

## 5. FUNCTIONAL REQUIREMENTS & TECHNICAL SPECIFICATIONS

**Functional requirements:**
- **FR-1 Tracking:** units stream GPS (1–5 s); registry holds last position; console shows live markers (± 5 m).
- **FR-2 Route computation:** fastest ambulance→pickup route via OSRM; origin = live GPS or `ambulance_position` fallback; < 2 s.
- **FR-3 Hospital discovery/ranking:** Overpass discovery → OSRM Table pre-rank (top 3) → candidate routes → rank by effective time.
- **FR-4 Incident-aware routing:** `congestion` (clearable) and `blockage` (not clearable) add delay; effective time can beat a closer-but-blocked hospital.
- **FR-5 Security recommendation:** if clearable congestion on the chosen route saves ≥ 5 min (300 s), recommend intervention (reason, type, time saved, location).
- **FR-6 Multi-unit dispatch:** coordinate the full 6-unit fleet; independent route/state per unit.
- **FR-7 Operator console:** view positions, set pickup, dispatch, manage incidents, trigger hospital pipeline, view ETA + recommendations.
- **FR-8 Ambulance interface:** stream GPS, view route, confirm pickup, see recommended hospital + alternatives + security banner.

**API endpoints:**

| Method | Endpoint | Notes | Status |
|--------|----------|-------|--------|
| GET | `/health` | – | 200 |
| GET | `/ambulances` | fleet (6 units) | 200 |
| POST | `/dispatch` | `{ambulance_id, pickup, patient?, ambulance_position?}` → `{status, duration_s, distance_m}` | 200 / 409 / 502 |
| POST | `/api/trigger-hospital/{id}` | run hospital pipeline from dispatch | 200 / 404 / 409 |
| WS | `/ws/ambulance/{id}` | gps / pickup_complete → route / hospital_route / error | 101 (4004 if unknown id) |
| WS | `/ws/dispatch` | snapshot, incident_snapshot, position, hospital_route | 101 |
| GET/POST/DELETE | `/mock/incidents[/{id}]` | incident CRUD; POST `{type, lat, lng, radius_m, delay_min}` | 200 / 201 / 422 / 404 |

**Key message shapes (WebSocket):**
- Ambulance→Backend: `{type:"gps", lat, lng, heading?, ts?}`, `{type:"pickup_complete"}`
- Backend→Ambulance: `{type:"route", geometry:[[lat,lng]…], distance_m, duration_s, pickup}`
- Backend→Both: `{type:"hospital_route", destination, geometry, duration_s, effective_duration_s, alternatives, security_recommendation}`
- Backend→Dispatch: `{type:"position", …}`, `{type:"snapshot", …}`, `{type:"incident_snapshot", …}`

**Data models:** `Incident{id, type:"congestion"|"blockage", lat, lng, radius_m, delay_min, description}`; `Ambulance{id, label, type, crew, plate}` + runtime GPS in registry.

**Performance:** route < 2000 ms, WS latency < 100 ms, incident filter < 500 ms, hospital query < 1500 ms; uptime SLA 99% (production).

**Security/reliability (now):** fleet-ID validation (unknown → 4004), Pydantic/field validation, typed errors → 502 / structured error payloads. **Planned (Phase 3):** HTTPS/WSS, API key/JWT, rate limiting, persistent audit log.

---

## 6. PROJECT PHASES & DELIVERABLES

**Phase 1 — Core Dispatch (✅ Complete, Wks 1–4):** FastAPI + WebSocket; React console with map/markers; plain-HTML driver page with GPS; OSRM route integration; 6-unit mock fleet. → `POST /dispatch`, `route` push, map-click pickup.

**Phase 2 — Intelligent Hospital Selection (✅ Complete, Wks 5–8):** Overpass discovery; OSRM Table pre-rank → top 3 → routes; `choose_hospital_route` (effective time); incident store + CRUD + console controls; security recommendation logic; `POST /api/trigger-hospital/{id}`. → pickup→hospital flow, alternatives, security banner.

**Phase 3 — Production Hardening & Scale (📋 Planned, Wks 9–12):** real traffic feed; hospital capacity/specialty filtering; deviation detection; auth (API key/JWT) + rate limiting + WSS; persistence (PostgreSQL audit, Redis cache); load testing (1000+ users); EC2/S3 production deploy + monitoring + runbooks.

---

## 7. SUCCESS CRITERIA

- **Functional:** [x] Phase 1 done · [x] Phase 2 done · [ ] Phase 3 deployed · [ ] endpoints < 2 s · [ ] WS stable 24 h+
- **Operational:** [ ] 100% staff trained · [ ] crews trained · [ ] on-call support · [ ] rollback tested
- **Business:** [ ] response time −15–25% · [ ] hospital choice ≥ 90% optimal · [ ] coordination −30% · [ ] uptime ≥ 99%/30 days
- **Quality:** [ ] test coverage ≥ 80% · [ ] integration tests for critical flows · [ ] load test 100+ units · [ ] security audit

---

## 8. RISK MANAGEMENT

| # | Risk | P | I | Mitigation |
|---|------|---|---|-----------|
| R1 | OSRM/Overpass unavailable | M | H | Typed errors (502/structured payloads); local hospital JSON fallback; self-hosted OSRM in Phase 3 |
| R2 | GPS accuracy / HTTPS requirement | M | M | Document constraints; HTTPS tunnel guide; GPS status indicator |
| R3 | WebSocket drops | M | H | Client auto-reconnect w/ backoff; clean unregister; snapshot resync on reconnect |
| R4 | Scaling > 100 units | L | H | Load testing; move in-memory registry to Redis (Phase 3) |
| R5 | Incident data inconsistency | L | M | Single-writer store; input validation; audit log (Phase 3) |
| R6 | Stale/incomplete hospital data | L | M | Periodic Overpass refresh; validate coords; local JSON fallback |
| R7 | No auth yet | M | H | Treat as trusted-network/demo; Phase 3 adds API key/JWT, WSS, rate limiting |
| R8 | Security-escalation misuse | L | M | Confirmation dialog; log every request; per-unit cooldown; weekly audit |
| R9 | Staff unfamiliarity | M | M | Hands-on training; in-app tooltips; first-week support |
| R10 | Phase 3 traffic feed fails | L | H | Keep mock incidents as fallback; circuit breaker |

---

**End of Statement of Work**
