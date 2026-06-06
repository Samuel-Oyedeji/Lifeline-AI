import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { MapContainer, TileLayer, Polyline, CircleMarker, Tooltip, useMap } from 'react-leaflet'
import { motion, AnimatePresence } from 'framer-motion'
import { BoltIcon, WarnIcon, CheckIcon } from '../components/Icons.jsx'

const DARK_TILES = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
const ATTR = '&copy; OpenStreetMap &copy; CARTO'
const DEFAULT_CENTER = [6.5095, 3.3711]

const CATEGORY_COLOR = {
  'Teaching Hospital':      '#22C55E',
  'Federal Medical Center': '#22C55E',
  'General Hospital':       '#4ade80',
  'Specialist Hospital':    '#06B6D4',
  'Medical Center':         '#38bdf8',
}

function kmBetween(lat1, lng1, lat2, lng2) {
  const R = 6371, r = Math.PI / 180
  const dlat = (lat2 - lat1) * r, dlng = (lng2 - lng1) * r
  const a = Math.sin(dlat / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(dlng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

// ── Map helpers ───────────────────────────────────────────────────────────────
function FitRoute({ positions }) {
  const map = useMap()
  useEffect(() => {
    if (positions?.length > 1) map.fitBounds(positions, { padding: [50, 50] })
  }, [positions, map])
  return null
}

function FlyTo({ coords }) {
  const map = useMap()
  useEffect(() => {
    if (coords) map.flyTo(coords, Math.max(map.getZoom(), 15), { duration: 1.2 })
  }, [coords, map])
  return null
}

// ── Toast component ───────────────────────────────────────────────────────────
function Toast({ toasts }) {
  return (
    <div style={{ position: 'absolute', top: 70, right: 14, zIndex: 1000, display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 300 }}>
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            style={{
              background: 'rgba(14,20,38,0.96)',
              border: `1px solid ${t.type === 'error' ? 'rgba(239,68,68,0.5)' : 'rgba(34,197,94,0.4)'}`,
              borderRadius: 10,
              padding: '10px 14px',
              fontSize: 13,
              color: t.type === 'error' ? '#ef4444' : '#22c55e',
              backdropFilter: 'blur(12px)',
            }}
          >
            {t.msg}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}

// ── Status chip ───────────────────────────────────────────────────────────────
function Chip({ color, label }) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '5px 11px', borderRadius: 20, fontSize: 12, fontWeight: 500,
      background: 'rgba(255,255,255,0.05)',
      border: '1px solid rgba(255,255,255,0.10)',
    }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, display: 'inline-block' }} />
      {label}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function AmbulancePage() {
  const [searchParams] = useSearchParams()
  const ambulanceId = searchParams.get('id') || 'LAG-A12'

  const [wsStatus,     setWsStatus]     = useState('connecting')
  const [gpsCoords,    setGpsCoords]    = useState(null)
  const [gpsLabel,     setGpsLabel]     = useState('Acquiring…')
  const [gpsError,     setGpsError]     = useState(false)
  const [pickupRoute,   setPickupRoute]   = useState(null)
  const [hospitalRoute, setHospitalRoute] = useState(null)
  const [preHospitalData, setPreHospitalData] = useState(null)
  const [triggering,    setTriggering]    = useState(false)
  const [pickedUp,      setPickedUp]      = useState(false)  // patient has been picked up
  const [toasts,        setToasts]        = useState([])
  const [allHospitals,  setAllHospitals]  = useState([])

  // ── Route visibility toggles ─────────────────────────────────────────────────
  const [showPickup,       setShowPickup]       = useState(true)   // red — on by default
  const [showPickupToHosp, setShowPickupToHosp] = useState(false)  // green — off
  const [showAmbToHosp,    setShowAmbToHosp]    = useState(false)  // amber — off

  const wsRef      = useRef(null)
  const timerRef   = useRef(null)
  const latLngRef  = useRef(null)
  const toastIdRef = useRef(0)
  // When preHospitalData is used on pickup, skip the backend's redundant hospital_route message
  const skipNextHospitalRoute = useRef(false)

  function addToast(msg, type = 'success') {
    const id = ++toastIdRef.current
    setToasts(prev => [...prev, { id, msg, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000)
  }

  // ── WebSocket ───────────────────────────────────────────────────────────────
  const connectWs = useCallback(() => {
    setWsStatus('connecting')
    const ws = new WebSocket(`ws://${location.host}/ws/ambulance/${ambulanceId}`)
    wsRef.current = ws

    ws.onopen = () => {
      setWsStatus('connected')
      clearTimeout(timerRef.current)
      if (latLngRef.current) {
        const [lat, lng] = latLngRef.current
        ws.send(JSON.stringify({ type: 'gps', lat, lng, heading: null, ts: Date.now() }))
      }
    }

    ws.onmessage = (evt) => {
      let msg
      try { msg = JSON.parse(evt.data) } catch { return }

      if (msg.type === 'route') {
        setPickupRoute(msg)
        setPreHospitalData(null)
        setPickedUp(false)
        // Reset toggles on new dispatch
        setShowPickup(true)
        setShowPickupToHosp(false)
        setShowAmbToHosp(false)
        setTriggering(false)
        addToast('Route received — navigate to patient', 'success')
      } else if (msg.type === 'pre_hospital_routes') {
        setPreHospitalData(msg)
        addToast(`Hospital pre-computed: ${msg.hospital.name}`, 'success')
      } else if (msg.type === 'hospital_route') {
        // If we already applied the pre-computed route on pickup, ignore this
        // redundant recomputation from the backend (it's based on ambulance GPS
        // position, not the pickup point, so it may differ unnecessarily).
        if (skipNextHospitalRoute.current) {
          skipNextHospitalRoute.current = false
          setTriggering(false)
        } else {
          setHospitalRoute(msg)
          setTriggering(false)
          addToast(`Hospital route — ${msg.destination.name}`, 'success')
        }
      } else if (msg.type === 'error') {
        addToast(msg.message ?? 'Backend error', 'error')
        setTriggering(false)
      }
    }

    ws.onclose = ws.onerror = () => {
      setWsStatus('reconnecting')
      timerRef.current = setTimeout(connectWs, 2500)
    }
  }, [ambulanceId])

  useEffect(() => {
    connectWs()
    return () => {
      clearTimeout(timerRef.current)
      wsRef.current?.close()
    }
  }, [connectWs])

  // ── GPS ─────────────────────────────────────────────────────────────────────
  // ── Hospital data ───────────────────────────────────────────────────────────
  useEffect(() => {
    fetch('/nigeria_hospitals.json')
      .then(r => r.json())
      .then(data => setAllHospitals(data.hospitals))
      .catch(() => {})
  }, [])

  // 20 nearest hospitals. Priority: GPS location → pickup point → Lagos default.
  // No radius filter — always show 20 nearest so drivers outside Lagos still see hospitals.
  const nearbyHospitals = useMemo(() => {
    if (!allHospitals.length) return []
    const pickup = pickupRoute?.pickup
    const [clat, clng] = gpsCoords
      ? gpsCoords
      : pickup
      ? [pickup.lat, pickup.lng]
      : DEFAULT_CENTER
    return allHospitals
      .map(h => ({ ...h, km: kmBetween(clat, clng, h.lat, h.lng) }))
      .sort((a, b) => a.km - b.km)
      .slice(0, 20)
  }, [allHospitals, pickupRoute, gpsCoords])

  // ── GPS ─────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!navigator.geolocation) {
      setGpsLabel('Not supported')
      return
    }

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const coords = [pos.coords.latitude, pos.coords.longitude]
        setGpsCoords(coords)
        latLngRef.current = coords
        setGpsLabel(`${coords[0].toFixed(4)}, ${coords[1].toFixed(4)}`)
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({
            type: 'gps',
            lat: coords[0],
            lng: coords[1],
            heading: pos.coords.heading ?? null,
            ts: Date.now(),
          }))
        }
      },
      (err) => {
        if (err.code === 1) {
          setGpsError(true)
          setGpsLabel('Permission denied')
        }
      },
      { enableHighAccuracy: false, maximumAge: 5000, timeout: 15000 }
    )

    return () => navigator.geolocation.clearWatch(watchId)
  }, [])

  // ── Patient picked up ───────────────────────────────────────────────────────────────
  function sendPickupComplete() {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      addToast('Not connected — please wait', 'error')
      return
    }

    setPickedUp(true)
    setShowPickup(false)
    setShowPickupToHosp(true)
    setShowAmbToHosp(true)

    if (preHospitalData?.pickup_to_hospital) {
      // Use the already-computed pickup → hospital route immediately.
      // No need to wait for the backend to recompute from the ambulance's GPS.
      skipNextHospitalRoute.current = true
      setHospitalRoute({
        destination: {
          name: preHospitalData.hospital.name,
          lat:  preHospitalData.hospital.lat,
          lng:  preHospitalData.hospital.lng,
        },
        geometry:           preHospitalData.pickup_to_hospital.geometry,
        distance_m:         preHospitalData.pickup_to_hospital.distance_m,
        duration_s:         preHospitalData.pickup_to_hospital.duration_s,
        effective_duration_s: preHospitalData.pickup_to_hospital.effective_duration_s,
        security_recommendation: null,
        alternatives: [],
      })
      setTriggering(false)
      addToast(`Navigating to ${preHospitalData.hospital.name}`, 'success')
    } else {
      // Pre-hospital data not available yet — wait for backend to compute
      setTriggering(true)
      addToast('Pickup confirmed — computing hospital route…', 'success')
    }

    wsRef.current.send(JSON.stringify({ type: 'pickup_complete' }))
  }

  function handleDroppedOff() {
    addToast('✓ Patient delivered — mission complete!', 'success')
    setPickedUp(false)
    setHospitalRoute(null)
    setPickupRoute(null)
    setPreHospitalData(null)
    setShowPickup(true)
    setShowPickupToHosp(false)
    setShowAmbToHosp(false)
  }

  // ── Derived ─────────────────────────────────────────────────────────────────
  const pickupPt   = pickupRoute?.pickup
  const hasRoute   = !!pickupRoute
  const hasHosp    = !!hospitalRoute
  const secRec     = hospitalRoute?.security_recommendation
  const alts       = hospitalRoute?.alternatives ?? []

  // Pre-hospital routes
  const prePickupToHosp = preHospitalData?.pickup_to_hospital
  const preAmbToHosp    = preHospitalData?.ambulance_to_hospital
  const preHospital     = preHospitalData?.hospital

  // Main geometry for FitRoute/FlyTo: hospital route if in hosp phase, else pickup
  const mainGeometry = hasHosp ? hospitalRoute.geometry : pickupRoute?.geometry

  const connColors = { connected: '#22c55e', reconnecting: '#f59e0b', connecting: '#94a3b8', error: '#ef4444' }
  const gpsColor   = gpsError ? '#ef4444' : gpsCoords ? '#22c55e' : '#94a3b8'

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#0b1020', display: 'flex', flexDirection: 'column', fontFamily: "'Inter', system-ui, sans-serif", color: '#fff' }}>

      {/* ── Top bar ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '11px 16px',
        background: '#0e1426', borderBottom: '1px solid rgba(255,255,255,0.09)',
        flexShrink: 0, flexWrap: 'wrap', zIndex: 10,
      }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.07em', color: '#64748b', textTransform: 'uppercase' }}>
            LifeLine AI · Ambulance
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#06b6d4', letterSpacing: '.02em' }}>
            {ambulanceId}
          </div>
        </div>
        <Chip color={connColors[wsStatus] ?? '#94a3b8'} label={
          wsStatus === 'connected' ? 'Connected' :
          wsStatus === 'reconnecting' ? 'Reconnecting…' : 'Connecting…'
        } />
        <Chip color={gpsColor} label={`GPS · ${gpsLabel}`} />
        {hasRoute && !hasHosp && (
          <div style={{ marginLeft: 'auto', fontSize: 13, color: '#94a3b8' }}>
            🔴 En route to patient
          </div>
        )}
        {hasHosp && (
          <div style={{ marginLeft: 'auto', fontSize: 13, color: '#22c55e' }}>
            🟢 En route to hospital
          </div>
        )}
      </div>

      {/* ── GPS permission error ── */}
      {gpsError && (
        <div style={{
          position: 'absolute', top: 64, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)',
          borderRadius: 10, padding: '9px 16px', fontSize: 13, color: '#ef4444',
          zIndex: 1001, whiteSpace: 'nowrap',
        }}>
          📍 Location permission denied — GPS will not stream.
        </div>
      )}

      {/* ── Map ── */}
      <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        <MapContainer
          center={DEFAULT_CENTER}
          zoom={14}
          style={{ height: '100%', width: '100%' }}
          scrollWheelZoom={true}
          zoomControl={true}
        >
          <TileLayer url={DARK_TILES} attribution={ATTR} subdomains="abcd" maxZoom={20} />

          {/* Fly to GPS if no route yet */}
          {gpsCoords && !mainGeometry && <FlyTo coords={gpsCoords} />}

          {/* Fit map to main route when received */}
          {mainGeometry?.length > 1 && <FitRoute positions={mainGeometry} />}

          {/* Route 1: Ambulance → Patient (red dashed) — toggleable */}
          {!hasHosp && showPickup && pickupRoute?.geometry?.length > 1 && (
            <Polyline
              positions={pickupRoute.geometry}
              pathOptions={{ color: '#EF4444', weight: 6, opacity: 0.95, dashArray: '8 10' }}
            />
          )}

          {/* Hospital phase: single green solid route */}
          {hasHosp && hospitalRoute?.geometry?.length > 1 && (
            <Polyline
              positions={hospitalRoute.geometry}
              pathOptions={{ color: '#22C55E', weight: 6, opacity: 0.95 }}
            />
          )}

          {/* Route 2: Pickup → Hospital (green dashed) — toggleable */}
          {prePickupToHosp?.geometry?.length > 1 && showPickupToHosp && (
            <Polyline
              positions={prePickupToHosp.geometry}
              pathOptions={{ color: '#22C55E', weight: 4, opacity: 0.80, dashArray: '6 8' }}
            />
          )}

          {/* Route 3: Ambulance → Hospital direct (amber dashed) — toggleable */}
          {preAmbToHosp?.geometry?.length > 1 && showAmbToHosp && (
            <Polyline
              positions={preAmbToHosp.geometry}
              pathOptions={{ color: '#F59E0B', weight: 4, opacity: 0.75, dashArray: '4 8' }}
            />
          )}

          {/* Own position — cyan */}
          {gpsCoords && (
            <CircleMarker
              center={gpsCoords}
              radius={11}
              pathOptions={{ color: '#fff', weight: 2.5, fillColor: '#06B6D4', fillOpacity: 1 }}
            >
              <Tooltip direction="top" offset={[0, -10]}>🚑 {ambulanceId}</Tooltip>
            </CircleMarker>
          )}

          {/* Patient pickup point — blue */}
          {pickupPt && (
            <CircleMarker
              center={[pickupPt.lat, pickupPt.lng]}
              radius={9}
              pathOptions={{ color: '#fff', weight: 2, fillColor: '#3B82F6', fillOpacity: 1 }}
            >
              <Tooltip permanent direction="top" offset={[0, -10]}>📍 Patient</Tooltip>
            </CircleMarker>
          )}

          {/* Nearby hospitals from real Lagos dataset */}
          {nearbyHospitals.map((h) => {
            const isSelected = hasHosp
              ? hospitalRoute.destination.name === h.name
              : preHospital?.name === h.name
            const baseColor  = CATEGORY_COLOR[h.category] ?? '#22C55E'
            return (
              <CircleMarker
                key={h.id}
                center={[h.lat, h.lng]}
                radius={isSelected ? 12 : 7}
                pathOptions={{
                  color: '#fff',
                  weight: isSelected ? 2.5 : 1,
                  fillColor: isSelected ? '#22C55E' : baseColor,
                  fillOpacity: isSelected ? 1 : 0.55,
                }}
              >
                <Tooltip
                  permanent={isSelected}
                  direction="top"
                  offset={[0, isSelected ? -12 : -7]}
                >
                  🏥 {h.name}
                  {` · ${h.category}`}
                  {` · ${h.km.toFixed(1)} km`}
                </Tooltip>
              </CircleMarker>
            )
          })}
        </MapContainer>

        {/* ── Unified bottom-left column: route panel + action button + hospital card ── */}
        <AnimatePresence>
          {hasRoute && (
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ type: 'spring', stiffness: 240, damping: 26 }}
              style={{
                position: 'absolute', bottom: 12, left: 12,
                zIndex: 500, width: 230,
                display: 'flex', flexDirection: 'column', gap: 8,
              }}
            >
              {/* Security banner — only when hospital route arrives */}
              {hasHosp && secRec?.recommended && (
                <div style={{
                  display: 'flex', alignItems: 'flex-start', gap: 8,
                  background: 'rgba(14,20,38,0.93)',
                  border: '1px solid rgba(245,158,11,0.5)',
                  borderRadius: 10, padding: '9px 12px',
                  color: '#f59e0b', fontSize: 12,
                  backdropFilter: 'blur(16px)',
                }}>
                  <WarnIcon style={{ width: 14, height: 14, flexShrink: 0, marginTop: 1 }} />
                  <span><strong>Security Detail</strong> — ~{Math.round(secRec.estimated_time_saved_s / 60)} min saved with escort</span>
                </div>
              )}

              {/* Hospital info card — slides in when hospital_route arrives */}
              {hasHosp && (
                <div style={{
                  background: 'rgba(11,16,32,0.93)',
                  border: '1px solid rgba(34,197,94,0.25)',
                  borderRadius: 14, padding: '12px 14px',
                  backdropFilter: 'blur(20px)',
                }}>
                  <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '.1em', color: '#22c55e', textTransform: 'uppercase', marginBottom: 5 }}>
                    🏥 Route to Hospital
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', lineHeight: 1.3, marginBottom: 6 }}>
                    {hospitalRoute.destination.name}
                  </div>
                  <div style={{ display: 'flex', gap: 18, marginBottom: alts.length > 0 ? 8 : 0 }}>
                    <div>
                      <div style={{ fontSize: 9, color: '#64748b' }}>Distance</div>
                      <div style={{ fontSize: 16, fontWeight: 700 }}>{(hospitalRoute.distance_m / 1000).toFixed(1)} km</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 9, color: '#64748b' }}>ETA</div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: '#f59e0b' }}>{Math.round(hospitalRoute.effective_duration_s / 60)} min</div>
                    </div>
                  </div>
                  {alts.length > 0 && (
                    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                      {alts.map(a => (
                        <div key={a.name} style={{
                          background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                          borderRadius: 5, padding: '2px 7px', fontSize: 10, color: '#64748b',
                        }}>
                          {a.name.split(' ').slice(0,3).join(' ')} · {Math.round(a.effective_duration_s / 60)} min
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Route toggles */}
              <div style={{
                background: 'rgba(11,16,32,0.93)',
                border: '1px solid rgba(255,255,255,0.10)',
                borderRadius: 14, padding: '12px 14px',
                backdropFilter: 'blur(20px)',
              }}>
                <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '.1em', color: '#475569', textTransform: 'uppercase', marginBottom: 10 }}>
                  Routes
                </div>
                {[
                  {
                    color: '#EF4444',
                    label: 'To Patient',
                    sub: pickupRoute
                      ? `${(pickupRoute.distance_m/1000).toFixed(1)} km · ${Math.round(pickupRoute.duration_s/60)} min`
                      : null,
                    active: showPickup,
                    toggle: () => setShowPickup(v => !v),
                    alwaysReady: true,
                  },
                  {
                    color: '#22C55E',
                    label: `Pickup → ${preHospital?.name?.split(' ').slice(0,3).join(' ') ?? (hospitalRoute?.destination?.name?.split(' ').slice(0,3).join(' ') ?? 'Hospital')}`,
                    sub: prePickupToHosp
                      ? `${(prePickupToHosp.distance_m/1000).toFixed(1)} km · ${Math.round(prePickupToHosp.effective_duration_s/60)} min`
                      : hasHosp
                      ? `${(hospitalRoute.distance_m/1000).toFixed(1)} km · ${Math.round(hospitalRoute.effective_duration_s/60)} min`
                      : null,
                    active: showPickupToHosp,
                    toggle: () => setShowPickupToHosp(v => !v),
                    alwaysReady: hasHosp,
                  },
                  {
                    color: '#F59E0B',
                    label: 'Ambulance → Hospital',
                    sub: preAmbToHosp
                      ? `${(preAmbToHosp.distance_m/1000).toFixed(1)} km · ${Math.round(preAmbToHosp.duration_s/60)} min`
                      : null,
                    active: showAmbToHosp,
                    toggle: () => setShowAmbToHosp(v => !v),
                    alwaysReady: false,
                  },
                ].map((row) => {
                  const loading = !row.alwaysReady && !preHospitalData
                  return (
                    <div key={row.label} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <span style={{
                        width: 22, height: 3, borderRadius: 2, flexShrink: 0,
                        backgroundImage: `repeating-linear-gradient(90deg,${row.color} 0,${row.color} 5px,transparent 5px,transparent 10px)`,
                        opacity: row.active ? 1 : 0.25,
                      }} />
                      <div style={{ flex: 1, minWidth: 0, opacity: row.active ? 1 : 0.45 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: '#e2e8f0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {row.label}
                        </div>
                        {loading ? (
                          <div style={{ fontSize: 10, color: '#475569', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span className="spinner" style={{ width: 8, height: 8, borderWidth: 1.5 }} /> computing…
                          </div>
                        ) : row.sub ? (
                          <div style={{ fontSize: 10, color: '#64748b' }}>{row.sub}</div>
                        ) : null}
                      </div>
                      <div
                        onClick={row.toggle}
                        style={{
                          width: 32, height: 17, borderRadius: 9, flexShrink: 0,
                          background: row.active ? row.color : 'rgba(255,255,255,0.12)',
                          cursor: 'pointer', position: 'relative',
                          transition: 'background 0.2s',
                          opacity: loading ? 0.4 : 1,
                          pointerEvents: loading ? 'none' : 'auto',
                        }}
                      >
                        <div style={{
                          width: 13, height: 13, borderRadius: 7, background: '#fff',
                          position: 'absolute', top: 2,
                          left: row.active ? 17 : 2,
                          transition: 'left 0.18s',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
                        }} />
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Action button — same width as panel */}
              <motion.button
                onClick={pickedUp ? handleDroppedOff : sendPickupComplete}
                disabled={triggering && !pickedUp}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.97 }}
                style={{
                  width: '100%', padding: '11px 16px', border: 'none',
                  borderRadius: 12, fontSize: 13, fontWeight: 700,
                  cursor: (triggering && !pickedUp) ? 'not-allowed' : 'pointer',
                  color: '#fff', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', gap: 7,
                  background: pickedUp
                    ? 'linear-gradient(135deg,#3b82f6,#1d4ed8)'
                    : (triggering && !pickedUp)
                    ? 'rgba(34,197,94,0.35)'
                    : 'linear-gradient(135deg,#22c55e,#16a34a)',
                  backdropFilter: 'blur(12px)',
                  boxShadow: pickedUp
                    ? '0 4px 20px rgba(59,130,246,0.35)'
                    : '0 4px 20px rgba(34,197,94,0.35)',
                  transition: 'background 0.3s',
                }}
              >
                {triggering && !pickedUp
                  ? <><span className="spinner" style={{ marginRight: 6 }} />Computing route…</>
                  : pickedUp
                  ? <><CheckIcon style={{ width: 16, height: 16 }} />Patient Dropped Off</>
                  : <><CheckIcon style={{ width: 16, height: 16 }} />Patient Picked Up</>
                }
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Toast container */}
        <Toast toasts={toasts} />
      </div>
    </div>
  )
}
