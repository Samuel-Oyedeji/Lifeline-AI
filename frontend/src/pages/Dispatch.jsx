import { useState, useEffect, useRef, useMemo } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { MapContainer, TileLayer, CircleMarker, Tooltip, useMapEvents, useMap } from 'react-leaflet'
import { useDispatch } from '../context/DispatchContext.jsx'
import { EMERGENCY_TYPES, PRIORITIES } from '../data/hospitals.js'
import { kmBetween, etaMinutes } from '../data/ambulances.js'
import { BoltIcon, PinIcon, PulseIcon, AmbulanceIcon } from '../components/Icons.jsx'
import AccidentNewsPanel from '../components/AccidentNewsPanel.jsx'


const DARK_TILES = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
const ATTR = '&copy; OpenStreetMap &copy; CARTO'

const pageMotion = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
  transition: { duration: 0.4, ease: 'easeOut' },
}

function PickupPicker({ onPick }) {
  useMapEvents({ click(e) { onPick([e.latlng.lat, e.latlng.lng]) } })
  return null
}

// Flies the map to new coords whenever they change
function RecenterMap({ coords }) {
  const map = useMap()
  const prev = useRef(null)
  useEffect(() => {
    if (!coords) return
    const [lat, lng] = coords
    if (prev.current && prev.current[0] === lat && prev.current[1] === lng) return
    prev.current = coords
    map.flyTo([lat, lng], 15, { duration: 1.4 })
  }, [coords, map])
  return null
}

// Nominatim geocoding with 600 ms debounce
function useGeocode(query) {
  const [result, setResult] = useState(null)   // { lat, lng } | null
  const [status, setStatus] = useState('idle') // idle | searching | found | notfound | error
  const timerRef = useRef(null)

  useEffect(() => {
    const q = query?.trim()
    if (!q || q.length < 3) {
      setStatus('idle')
      return
    }

    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(async () => {
      setStatus('searching')
      try {
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1&countrycodes=ng`
        const res = await fetch(url, { headers: { 'Accept-Language': 'en' } })
        const data = await res.json()
        if (data.length > 0) {
          setResult({ lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) })
          setStatus('found')
        } else {
          setResult(null)
          setStatus('notfound')
        }
      } catch {
        setResult(null)
        setStatus('error')
      }
    }, 600)

    return () => clearTimeout(timerRef.current)
  }, [query])

  return { result, status }
}

export default function Dispatch() {
  const navigate = useNavigate()
  const { dispatch, setDispatch, pickupLatLng, setPickupLatLng, liveAmbulances } = useDispatch()
  const [analyzing, setAnalyzing] = useState(false)

  const set = (patch) => setDispatch((d) => ({ ...d, ...patch }))

  const fleet = useMemo(() =>
    liveAmbulances
      .map((a) => ({ ...a, distanceKm: kmBetween(a.coords, pickupLatLng), etaMin: etaMinutes(kmBetween(a.coords, pickupLatLng)) }))
      .sort((a, b) => a.distanceKm - b.distanceKm),
    [liveAmbulances, pickupLatLng]
  )

  const { result: geoResult, status: geoStatus } = useGeocode(dispatch.patientLocation)

  // Apply geocoded result to pickup coords
  useEffect(() => {
    if (geoResult) setPickupLatLng([geoResult.lat, geoResult.lng])
  }, [geoResult, setPickupLatLng])

  function runAnalysis() {
    setAnalyzing(true)
    setTimeout(() => navigate('/ambulances'), 3500)
  }

  const geoIndicator = {
    idle:       null,
    searching:  <span className="spinner" style={{ width: 14, height: 14 }} />,
    found:      <span style={{ color: 'var(--success)', fontSize: 13 }}>✓</span>,
    notfound:   <span style={{ color: 'var(--warning)', fontSize: 13 }}>?</span>,
    error:      <span style={{ color: 'var(--critical)', fontSize: 13 }}>!</span>,
  }[geoStatus]

  return (
    <motion.div className="scroll" {...pageMotion}>
      <div className="page-head" style={{ position: 'relative' }}>
        <span className="chip" style={{ marginBottom: 14 }}>
          <span className="dot" style={{ background: 'var(--critical)' }} /> EMERGENCY DISPATCH
        </span>
        <h1>
          Dispatch with <span className="grad-text">predictive intelligence</span>
        </h1>
        <p>Log the emergency. LifeLine AI predicts congestion and routes to the best hospital.</p>

        <a
          href="/#/ambulance"
          target="_blank"
          rel="noopener noreferrer"
          className="sim-btn"
        >
          <AmbulanceIcon style={{ width: 15, height: 15 }} />
          Simulate Ambulance
        </a>
      </div>

      <div className="grid-2">
        {/* Left — the dispatch form */}
        <motion.div
          className="glass card pad-lg"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
        >
          <div className="field">
            <span className="label">Patient Location</span>
            <div style={{ position: 'relative' }}>
              <PinIcon
                style={{
                  position: 'absolute',
                  left: 14,
                  top: 14,
                  color: 'var(--secondary)',
                  width: 18,
                  height: 18,
                }}
              />
              <input
                className="input"
                style={{ paddingLeft: 42, paddingRight: 36 }}
                value={dispatch.patientLocation}
                onChange={(e) => set({ patientLocation: e.target.value })}
                placeholder="Type an address or landmark…"
              />
              {geoIndicator && (
                <span style={{
                  position: 'absolute', right: 12, top: '50%',
                  transform: 'translateY(-50%)',
                  display: 'flex', alignItems: 'center',
                }}>
                  {geoIndicator}
                </span>
              )}
            </div>
            {geoStatus === 'notfound' && (
              <p style={{ color: 'var(--warning)', fontSize: 12, marginTop: 4 }}>
                Location not found — click the map to pin manually.
              </p>
            )}
            {geoStatus === 'found' && (
              <p style={{ color: 'var(--text-dim)', fontSize: 12, marginTop: 4 }}>
                {pickupLatLng[0].toFixed(5)}, {pickupLatLng[1].toFixed(5)}
              </p>
            )}
          </div>

          <div className="field">
            <span className="label">Emergency Type</span>
            <div className="options cols-4">
              {EMERGENCY_TYPES.map((t) => (
                <button
                  key={t.id}
                  className={'option' + (dispatch.emergencyType === t.id ? ' selected' : '')}
                  onClick={() => set({ emergencyType: t.id })}
                >
                  <span className="opt-ico">{t.icon}</span>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <span className="label">Priority</span>
            <div className="options cols-2" style={{ gridTemplateColumns: 'repeat(3,1fr)' }}>
              {PRIORITIES.map((p) => (
                <button
                  key={p.id}
                  className={'option' + (dispatch.priority === p.id ? ' selected' : '')}
                  onClick={() => set({ priority: p.id })}
                  style={
                    dispatch.priority === p.id
                      ? { borderColor: p.color, boxShadow: `0 0 0 1px ${p.color}` }
                      : undefined
                  }
                >
                  <span className="opt-dot" style={{ background: p.color }} />
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <motion.button
            className="btn"
            style={{ marginTop: 8 }}
            whileHover={{ scale: 1.015 }}
            whileTap={{ scale: 0.98 }}
            onClick={runAnalysis}
            disabled={analyzing}
          >
            <BoltIcon style={{ width: 19, height: 19 }} />
            Dispatch Ambulance
          </motion.button>
        </motion.div>

        {/* Right — context / live brief */}
        <motion.div
          className="stack"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
        >
          <AccidentNewsPanel />

          <div className="grid-3" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <div className="glass stat">
              <div className="stat-k">Avg. response gain</div>
              <div className="stat-v" style={{ color: 'var(--success)' }}>
                4 min
              </div>
              <div className="stat-sub">vs. naive routing</div>
            </div>
            <div className="glass stat">
              <div className="stat-k">Predictions / hr</div>
              <div className="stat-v" style={{ color: 'var(--secondary)' }}>
                1,240
              </div>
              <div className="stat-sub">across Lagos grid</div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Nearby units grid */}
      <motion.div
        style={{ marginTop: 22 }}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 12 }}>
          <AmbulanceIcon style={{ width: 15, height: 15, color: 'var(--secondary)' }} />
          <span className="label" style={{ margin: 0 }}>Nearby Units</span>
          <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-faint)' }}>
            {fleet.filter(a => a.status === 'available').length} available
          </span>
        </div>
        <div className="unit-grid">
          {fleet.map((a) => {
            const busy = a.status === 'busy' || a.status === 'offline'
            const statusColor = a.status === 'available' ? 'var(--success)' : a.status === 'offline' ? 'var(--text-faint)' : 'var(--warning)'
            const statusLabel = a.status === 'available' ? 'Available' : a.status === 'offline' ? 'Offline' : 'On call'
            return (
              <div key={a.id} className={'glass unit-card' + (busy ? ' unit-card--busy' : '')}>
                <div className="uc-head">
                  <span className="uc-id">{a.id}</span>
                  <span className="uc-status" style={{ color: statusColor }}>● {statusLabel}</span>
                </div>
                <div className="uc-type">{a.type === 'Advanced Life Support' ? 'ALS' : 'BLS'} · {a.crew}</div>
                <div className="uc-metrics">
                  <span>{a.distanceKm.toFixed(1)} km</span>
                  <span style={{ color: 'var(--text-faint)' }}>·</span>
                  <span style={{ color: 'var(--secondary)' }}>{a.etaMin} min ETA</span>
                </div>
              </div>
            )
          })}
        </div>
      </motion.div>

      {/* Dispatch loader overlay */}
      {analyzing && (
        <motion.div className="analyze-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="dispatch-loader">
            <div className="dl-rings">
              <span className="dl-ring" />
              <span className="dl-ring" />
              <span className="dl-ring" />
              <div className="dl-core">
                <PulseIcon style={{ width: 26, height: 26, color: '#fff' }} />
              </div>
            </div>
            <p className="dl-label">Dispatching…</p>
          </div>
        </motion.div>
      )}
    </motion.div>
  )
}
