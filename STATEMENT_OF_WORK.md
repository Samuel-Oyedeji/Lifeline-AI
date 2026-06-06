# STATEMENT OF WORK (SOW)
## Lifeline AI — Predictive Emergency Routing & Hospital Intelligence Platform

**Project:** Lifeline AI &nbsp;|&nbsp; **Type:** Real-time Emergency Response & Logistics
**Status:** Phase 1 & 2 Complete, Phase 3 Planned &nbsp;|&nbsp; **Version:** 2.2 &nbsp;|&nbsp; **Updated:** June 2026

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

**Layers:**
- **Frontend:** Dispatch console — React 18 + Vite (react-router-dom, react-leaflet/Leaflet, framer-motion, lucide-react), hand-written CSS3. Ambulance driver page — dependency-free HTML/JS for fast load on in-vehicle devices.
- **Backend (FastAPI/Uvicorn):** WebSocket handlers (`/ws/ambulance/{id}`, `/ws/dispatch`); dispatch + hospital pipeline; AI decision layer (`choose_route`, `choose_hospital_route`); in-memory registry; incident store.
- **Data/External:** OSRM demo (`/route`, `/table`), Overpass API, browser Geolocation; seed data from `ambulances.json`, `mock_incidents.json`, `nigeriahealthfacilities.json`.

**Tech stack:** FastAPI + Uvicorn + Pydantic + httpx (Python 3.11+); React 18 + Vite + Leaflet (console); plain HTML/JS (driver); OSRM + Overpass (external); AWS (hosting — see 4.1).

### 4.1 AWS Deployment & Justification

The platform is deployed on AWS to get managed scaling, TLS, and observability without standing up our own infrastructure.

- **Frontend → Amazon S3 + CloudFront.** The static UI (React console build + ambulance driver page) is served from an S3 bucket fronted by CloudFront. *Why:* near-zero hosting cost, global CDN edge caching for low latency, free managed TLS via ACM, and bucket versioning for instant rollback. No servers to patch.
- **Backend → Amazon EC2 (now) → ECS/Fargate (Phase 3).** FastAPI/Uvicorn currently runs on **EC2 in an Auto Scaling group behind an Application Load Balancer (ALB)**. *Why EC2 now:* full OS control and predictable behavior for **long-lived WebSocket connections**, which is the project's defining traffic pattern. *Phase-3 path:* migrate to **ECS/Fargate** for simpler operations, container-native autoscaling, and no OS maintenance, once the WebSocket connection-draining behavior is validated under Fargate.
- **Real-time at scale → ElastiCache (Redis).** Moves the ambulance registry and session state out of process memory so any backend instance can serve any connection (no sticky sessions). Removes the current single-instance limitation.
- **Persistence → Amazon RDS (PostgreSQL, Multi-AZ).** Audit log of dispatches, incidents, and security recommendations, plus historical analytics, with automated backups and failover.
- **Edge & networking → Route 53 + ALB + ACM + AWS WAF.** DNS, HTTPS/WSS termination, managed certificates, and L7 protection for public endpoints.
- **Secrets & encryption → AWS Secrets Manager + KMS.** External API keys and DB credentials stored as managed secrets; encryption at rest via KMS.
- **Observability → Amazon CloudWatch.** Centralized logs, metrics, dashboards, and alarms (latency, error rate, WebSocket count, OSRM/Overpass failure rate).

**AWS service mapping:**

| Concern | AWS Service | Notes |
|---------|-------------|-------|
| Static frontend | S3 + CloudFront (+ ACM) | CDN, TLS, versioning, lifecycle policies |
| Backend compute (now) | EC2 + Auto Scaling + ALB | WebSocket-friendly, full control |
| Backend compute (Phase 3) | ECS/Fargate + ALB | Less ops, container autoscaling |
| Shared state / cache | ElastiCache (Redis) | Registry + sessions, no sticky sessions |
| Persistence | RDS (PostgreSQL, Multi-AZ) | Audit/history + automated backups |
| DNS / TLS / L7 firewall | Route 53 / ACM / WAF | Public-edge hardening |
| Secrets / encryption | Secrets Manager + KMS | API keys, DB creds, at-rest encryption |
| Logs / metrics / alarms | CloudWatch | Operational visibility |

### 4.2 AWS Best-Practice Checklist (Phase 3 hardening)

- [ ] **Compute:** ALB (HTTPS/WSS) with ACM TLS; EC2 Auto Scaling (or ECS Service) across **multi-AZ**; enable ALB connection draining for graceful WebSocket shutdown.
- [ ] **State:** ElastiCache (Redis) for registry/sessions — **no sticky sessions**.
- [ ] **Data:** RDS **Multi-AZ** with automated backups + point-in-time recovery; encryption at rest.
- [ ] **Frontend:** S3 + CloudFront with **bucket versioning** and lifecycle policies; OAC so the bucket is not public.
- [ ] **Network:** VPC with public/private subnets; backend in private subnets; **Security Groups** least-open; admin access via **SSM Session Manager** (no bastion / open SSH).
- [ ] **Identity:** **IAM least-privilege** roles per service; no long-lived keys on instances (use instance roles).
- [ ] **Secrets:** **Secrets Manager + KMS** for all credentials and external API keys.
- [ ] **Edge security:** **AWS WAF** on CloudFront/ALB; rate limiting.
- [ ] **Observability:** **CloudWatch** logs/metrics/alarms; dashboards for latency, errors, and live WebSocket count.
- [ ] **Resilience:** health checks + auto-recovery; tested rollback (S3 version + previous task/AMI).

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

**Security/reliability (now):** fleet-ID validation (unknown → 4004), Pydantic/field validation, typed errors → 502 / structured error payloads. **Planned (Phase 3):** HTTPS/WSS via ACM, API key/JWT, WAF + rate limiting, persistent audit log (see 4.2).

---

## 6. PROJECT PHASES & DELIVERABLES

**Phase 1 — Core Dispatch (✅ Complete, Wks 1–4):** FastAPI + WebSocket; React console with map/markers; plain-HTML driver page with GPS; OSRM route integration; 6-unit mock fleet. → `POST /dispatch`, `route` push, map-click pickup.

**Phase 2 — Intelligent Hospital Selection (✅ Complete, Wks 5–8):** Overpass discovery; OSRM Table pre-rank → top 3 → routes; `choose_hospital_route` (effective time); incident store + CRUD + console controls; security recommendation logic; `POST /api/trigger-hospital/{id}`. → pickup→hospital flow, alternatives, security banner.

**Phase 3 — Production Hardening & Scale on AWS (📋 Planned, Wks 9–12):** real traffic feed; hospital capacity/specialty filtering; deviation detection; auth (API key/JWT) + WAF/rate limiting + HTTPS/WSS; persistence (RDS PostgreSQL audit, ElastiCache Redis registry); EC2 Auto Scaling behind ALB (Fargate migration path); CloudWatch monitoring; load testing (1000+ users); deploy runbooks. See 4.1–4.2.

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
| R2 | GPS accuracy / HTTPS requirement | M | M | Document constraints; HTTPS via ACM; GPS status indicator |
| R3 | WebSocket drops | M | H | Client auto-reconnect w/ backoff; ALB connection draining; snapshot resync on reconnect |
| R4 | Scaling > 100 units | L | H | Load testing; move in-memory registry to ElastiCache (Redis); Auto Scaling / Fargate |
| R5 | Incident data inconsistency | L | M | Single-writer store; input validation; RDS audit log (Phase 3) |
| R6 | Stale/incomplete hospital data | L | M | Periodic Overpass refresh; validate coords; local JSON fallback |
| R7 | No auth yet | M | H | Treat as trusted-network/demo; Phase 3 adds API key/JWT, WSS, WAF, rate limiting |
| R8 | Security-escalation misuse | L | M | Confirmation dialog; log every request; per-unit cooldown; weekly audit |
| R9 | Staff unfamiliarity | M | M | Hands-on training; in-app tooltips; first-week support |
| R10 | Phase 3 traffic feed fails | L | H | Keep mock incidents as fallback; circuit breaker |

---

**End of Statement of Work**
