import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { MapContainer, TileLayer, CircleMarker, Tooltip, useMapEvents, useMap } from 'react-leaflet'
import { useDispatch } from '../context/DispatchContext.jsx'
import { EMERGENCY_TYPES, PRIORITIES } from '../data/hospitals.js'
import { BoltIcon, CheckIcon, PinIcon } from '../components/Icons.jsx'

const STEPS = [
  'Locating Nearest Ambulance',
  'Analyzing Hospitals',
  'Checking Traffic',
  'Predicting Congestion',
]

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
  const { dispatch, setDispatch, pickupLatLng, setPickupLatLng } = useDispatch()
  const [analyzing, setAnalyzing] = useState(false)
  const [stepDone, setStepDone] = useState(-1)

  const set = (patch) => setDispatch((d) => ({ ...d, ...patch }))

  const { result: geoResult, status: geoStatus } = useGeocode(dispatch.patientLocation)

  // Apply geocoded result to pickup coords
  useEffect(() => {
    if (geoResult) setPickupLatLng([geoResult.lat, geoResult.lng])
  }, [geoResult, setPickupLatLng])

  function runAnalysis() {
    setAnalyzing(true)
    setStepDone(-1)
    STEPS.forEach((_, i) => {
      setTimeout(() => setStepDone(i), 700 * (i + 1))
    })
    setTimeout(() => navigate('/ambulances'), 700 * (STEPS.length + 1))
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
      <div className="page-head">
        <span className="chip" style={{ marginBottom: 14 }}>
          <span className="dot" style={{ background: 'var(--critical)' }} /> EMERGENCY DISPATCH
        </span>
        <h1>
          Dispatch with <span className="grad-text">predictive intelligence</span>
        </h1>
        <p>Log the emergency. LifeLine AI predicts congestion and routes to the best hospital.</p>
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
          <div className="glass card">
            <span className="label">What happens next</span>
            <p style={{ color: 'var(--text-dim)', fontSize: 14.5, lineHeight: 1.7, marginTop: 12 }}>
              On dispatch, LifeLine AI scores every nearby hospital on bed and ICU availability,
              specialist match, live ETA, and <strong style={{ color: '#fff' }}>predicted</strong>{' '}
              congestion — not just current traffic.
            </p>
            <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
              <span className="chip">🏥 15 hospitals monitored</span>
              <span className="chip">📡 Live traffic grid</span>
              <span className="chip">🔮 6-min forecast</span>
            </div>
          </div>

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

      {/* Pickup location map */}
      <motion.div
        className="glass"
        style={{ marginTop: 22, borderRadius: 14, overflow: 'hidden' }}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <div style={{ padding: '12px 16px 10px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <PinIcon style={{ width: 16, height: 16, color: 'var(--secondary)' }} />
          <span className="label" style={{ margin: 0 }}>
            Pickup location — type above to geocode, or click map to pin
          </span>
          <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-dim)', fontVariantNumeric: 'tabular-nums' }}>
            {pickupLatLng[0].toFixed(5)}, {pickupLatLng[1].toFixed(5)}
          </span>
        </div>
        <div style={{ height: 260 }}>
          <MapContainer center={pickupLatLng} zoom={14} scrollWheelZoom={true} zoomControl={false}>
            <TileLayer url={DARK_TILES} attribution={ATTR} subdomains="abcd" maxZoom={20} />
            <RecenterMap coords={pickupLatLng} />
            <PickupPicker onPick={setPickupLatLng} />
            <CircleMarker
              center={pickupLatLng}
              radius={10}
              pathOptions={{ color: '#fff', weight: 2, fillColor: '#3B82F6', fillOpacity: 1 }}
            >
              <Tooltip permanent direction="top" offset={[0, -10]}>
                📍 {dispatch.patientLocation || 'Patient'}
              </Tooltip>
            </CircleMarker>
          </MapContainer>
        </div>
      </motion.div>

      {/* Analyzing overlay */}
      {analyzing && (
        <motion.div className="analyze-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <motion.div
            className="glass analyze-card"
            initial={{ opacity: 0, scale: 0.92, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 240, damping: 22 }}
          >
            <h3>
              <span className="grad-text">LifeLine AI</span> is thinking…
            </h3>
            <p className="sub">Crunching live traffic, bed availability & congestion forecasts.</p>

            {STEPS.map((label, i) => {
              const done = stepDone >= i
              const isCurrent = !done && (i === 0 ? stepDone < 0 : stepDone === i - 1)
              return (
                <div key={label} className={'step-row ' + (done ? 'done' : isCurrent ? '' : 'idle')}>
                  <span className="step-ic">
                    {done ? (
                      <motion.span
                        className="check"
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 18 }}
                      >
                        <CheckIcon style={{ width: 16, height: 16 }} />
                      </motion.span>
                    ) : isCurrent ? (
                      <span className="spinner" />
                    ) : (
                      <span className="pending" />
                    )}
                  </span>
                  <span className="step-label">{label}…</span>
                </div>
              )
            })}
          </motion.div>
        </motion.div>
      )}
    </motion.div>
  )
}
