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
  const [gpsCoords,    setGpsCoords]    = useState(null)      // [lat, lng] — own position
  const [gpsLabel,     setGpsLabel]     = useState('Acquiring…')
  const [gpsError,     setGpsError]     = useState(false)
  const [pickupRoute,   setPickupRoute]   = useState(null)   // route WS message
  const [hospitalRoute, setHospitalRoute] = useState(null)   // hospital_route WS message
  const [triggering,    setTriggering]    = useState(false)  // sending pickup_complete
  const [toasts,        setToasts]        = useState([])
  const [allHospitals,  setAllHospitals]  = useState([])     // from lagos_hospitals.json

  const wsRef      = useRef(null)
  const timerRef   = useRef(null)
  const latLngRef  = useRef(null)   // latest GPS, used to resend on reconnect
  const toastIdRef = useRef(0)

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
        setTriggering(false)
        addToast('Route received — navigate to patient', 'success')
      } else if (msg.type === 'hospital_route') {
        setHospitalRoute(msg)
        addToast(`Hospital route — ${msg.destination.name}`, 'success')
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
    fetch('/lagos_hospitals.json')
      .then(r => r.json())
      .then(data => setAllHospitals(data.hospitals))
      .catch(() => {})
  }, [])

  // 20 nearest hospitals to the patient pickup point (or Lagos default).
  // Deliberately NOT using gpsCoords — the driver may be outside Lagos,
  // but the patient and hospitals are always in the Lagos area.
  const nearbyHospitals = useMemo(() => {
    if (!allHospitals.length) return []
    const pickup = pickupRoute?.pickup
    const [clat, clng] = pickup ? [pickup.lat, pickup.lng] : DEFAULT_CENTER
    return allHospitals
      .map(h => ({ ...h, km: kmBetween(clat, clng, h.lat, h.lng) }))
      .filter(h => h.km < 15)
      .sort((a, b) => a.km - b.km)
      .slice(0, 20)
  }, [allHospitals, pickupRoute])

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

  // ── Pickup complete ──────────────────────────────────────────────────────────
  function sendPickupComplete() {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      addToast('Not connected — please wait', 'error')
      return
    }
    setTriggering(true)
    wsRef.current.send(JSON.stringify({ type: 'pickup_complete' }))
    addToast('Pickup confirmed — computing hospital route…', 'success')
  }

  // ── Derived ─────────────────────────────────────────────────────────────────
  const geometry   = hospitalRoute?.geometry ?? pickupRoute?.geometry
  const routeColor = hospitalRoute ? '#22C55E' : '#EF4444'
  const pickupPt   = pickupRoute?.pickup
  const hasRoute   = !!pickupRoute
  const hasHosp    = !!hospitalRoute
  const secRec     = hospitalRoute?.security_recommendation
  const alts       = hospitalRoute?.alternatives ?? []

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
          {gpsCoords && !geometry && <FlyTo coords={gpsCoords} />}

          {/* Fit to route when received */}
          {geometry?.length > 1 && <FitRoute positions={geometry} />}

          {/* Route polyline */}
          {geometry?.length > 1 && (
            <Polyline
              positions={geometry}
              pathOptions={{
                color: routeColor,
                weight: 6,
                opacity: 0.95,
                dashArray: hasHosp ? undefined : '8 10',
              }}
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
            const isSelected = hasHosp && hospitalRoute.destination.name === h.name
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

        {/* ── Bottom info panel ── */}
        <AnimatePresence>
          {hasRoute && (
            <motion.div
              initial={{ y: 120, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 120, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 220, damping: 26 }}
              style={{
                position: 'absolute', bottom: 0, left: 0, right: 0,
                background: 'linear-gradient(180deg, transparent 0%, rgba(11,16,32,0.97) 30%)',
                padding: '36px 14px 16px',
                zIndex: 500,
                pointerEvents: 'none',
              }}
            >
              {/* Security banner */}
              {secRec?.recommended && (
                <div style={{
                  pointerEvents: 'auto',
                  display: 'flex', alignItems: 'center', gap: 10,
                  background: 'rgba(14,20,38,0.92)',
                  border: '1px solid rgba(245,158,11,0.55)',
                  borderRadius: 12, padding: '11px 14px',
                  color: '#f59e0b', fontSize: 13, marginBottom: 10,
                  backdropFilter: 'blur(16px)',
                }}>
                  <WarnIcon style={{ width: 17, height: 17, flexShrink: 0 }} />
                  <span>
                    <strong>Security Detail Recommended</strong>
                    {' '}— ~{Math.round(secRec.estimated_time_saved_s / 60)} min could be saved with escort.
                  </span>
                </div>
              )}

              {/* Route card */}
              <div style={{
                pointerEvents: 'auto',
                background: 'rgba(14,20,38,0.92)',
                border: '1px solid rgba(255,255,255,0.10)',
                borderRadius: 14, padding: '14px 16px',
                backdropFilter: 'blur(20px)',
              }}>
                {!hasHosp ? (
                  <>
                    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.07em', color: '#64748b', textTransform: 'uppercase', marginBottom: 4 }}>
                      ⬅ Route to Patient
                    </div>
                    <div style={{ display: 'flex', gap: 24, marginBottom: 14 }}>
                      <div>
                        <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 2 }}>Distance</div>
                        <div style={{ fontSize: 20, fontWeight: 700 }}>
                          {(pickupRoute.distance_m / 1000).toFixed(1)} km
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 2 }}>ETA</div>
                        <div style={{ fontSize: 20, fontWeight: 700, color: '#22c55e' }}>
                          {Math.round(pickupRoute.duration_s / 60)} min
                        </div>
                      </div>
                    </div>
                    <motion.button
                      style={{
                        width: '100%', padding: '14px 20px', border: 'none',
                        borderRadius: 10, fontSize: 15, fontWeight: 600,
                        cursor: triggering ? 'not-allowed' : 'pointer',
                        color: '#fff', display: 'flex', alignItems: 'center',
                        justifyContent: 'center', gap: 8,
                        background: triggering
                          ? 'rgba(34,197,94,0.4)'
                          : 'linear-gradient(135deg,#22c55e,#16a34a)',
                      }}
                      whileHover={triggering ? undefined : { scale: 1.01 }}
                      whileTap={triggering ? undefined : { scale: 0.98 }}
                      onClick={sendPickupComplete}
                      disabled={triggering}
                    >
                      {triggering
                        ? <><span className="spinner" style={{ marginRight: 8 }} />Computing hospital route…</>
                        : <><CheckIcon style={{ width: 18, height: 18 }} />Patient Picked Up</>
                      }
                    </motion.button>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.07em', color: '#64748b', textTransform: 'uppercase', marginBottom: 4 }}>
                      🏥 Route to Hospital
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 10 }}>
                      {hospitalRoute.destination.name}
                    </div>
                    <div style={{ display: 'flex', gap: 24, marginBottom: 10 }}>
                      <div>
                        <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 2 }}>Distance</div>
                        <div style={{ fontSize: 20, fontWeight: 700 }}>
                          {(hospitalRoute.distance_m / 1000).toFixed(1)} km
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 2 }}>ETA (with incidents)</div>
                        <div style={{ fontSize: 20, fontWeight: 700, color: '#f59e0b' }}>
                          {Math.round(hospitalRoute.effective_duration_s / 60)} min
                        </div>
                      </div>
                    </div>
                    {alts.length > 0 && (
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {alts.map(a => (
                          <div key={a.name} style={{
                            background: 'rgba(255,255,255,0.04)',
                            border: '1px solid rgba(255,255,255,0.09)',
                            borderRadius: 8, padding: '5px 11px',
                            fontSize: 12, color: '#94a3b8',
                          }}>
                            {a.name} · {Math.round(a.effective_duration_s / 60)} min
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Toast container */}
        <Toast toasts={toasts} />
      </div>
    </div>
  )
}
