import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { useDispatch } from '../context/DispatchContext.jsx'
import MapView from '../components/MapView.jsx'
import { WarnIcon, BoltIcon, FlagIcon } from '../components/Icons.jsx'

const pageMotion = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.5 },
}

export default function RouteView() {
  const navigate = useNavigate()
  const { pickupRoute, hospitalRoute, pickupLatLng, selectedAmbulance, incidents } = useDispatch()
  const [triggering, setTriggering] = useState(false)
  const [triggerError, setTriggerError] = useState(null)

  // Showing hospital route after patient pickup; pickup route otherwise
  const isHospitalPhase = !!hospitalRoute

  const geometry = isHospitalPhase ? hospitalRoute.geometry : pickupRoute?.geometry
  const routeColor = isHospitalPhase ? '#22C55E' : '#EF4444'

  const etaMin = isHospitalPhase
    ? Math.round(hospitalRoute.effective_duration_s / 60)
    : pickupRoute
    ? Math.round(pickupRoute.duration_s / 60)
    : '—'

  const distanceKm = isHospitalPhase
    ? (hospitalRoute.distance_m / 1000).toFixed(1)
    : pickupRoute
    ? (pickupRoute.distance_m / 1000).toFixed(1)
    : '—'

  const congestionIncidents = incidents.filter((i) => i.type === 'congestion')

  // Show loading state while waiting for the WS route message
  if (!geometry) {
    return (
      <motion.div
        style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexDirection: 'column', gap: 18, background: 'var(--bg)',
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <span className="spinner" style={{ width: 36, height: 36, borderWidth: 3 }} />
        <p style={{ color: 'var(--text-dim)', fontSize: 15 }}>
          Waiting for route from backend…
        </p>
      </motion.div>
    )
  }

  async function handlePickedUp() {
    if (!selectedAmbulance) return
    setTriggering(true)
    setTriggerError(null)
    try {
      const res = await fetch(`/api/trigger-hospital/${selectedAmbulance.id}`, { method: 'POST' })
      if (!res.ok) {
        const err = await res.json()
        setTriggerError(err.detail?.message ?? err.detail ?? 'Hospital pipeline failed')
        setTriggering(false)
      }
      // Navigation driven by WS hospital_route message → DispatchContext
    } catch {
      setTriggerError('Network error — could not reach server')
      setTriggering(false)
    }
  }

  return (
    <motion.div style={{ position: 'absolute', inset: 0 }} {...pageMotion}>
      <div className="map-wrap">
        <MapView
          geometry={geometry}
          routeColor={routeColor}
          patientCoords={pickupLatLng}
          hospital={isHospitalPhase ? hospitalRoute.destination : null}
          incidents={incidents}
        />
      </div>

      {/* Floating metric cards (top-left) */}
      <div className="map-overlays">
        {[
          { k: isHospitalPhase ? 'Hospital ETA' : 'Pickup ETA', v: `${etaMin} min`, c: '#fff' },
          { k: 'Distance', v: `${distanceKm} km`, c: 'var(--secondary)' },
        ].map((card, i) => (
          <motion.div
            key={card.k}
            className="glass float-card"
            initial={{ opacity: 0, y: -14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 + i * 0.1 }}
          >
            <div className="fc-k">{card.k}</div>
            <div className="fc-v" style={{ color: card.c }}>{card.v}</div>
          </motion.div>
        ))}
      </div>

      {/* AI alert panel (right) */}
      <AnimatePresence>
        {!isHospitalPhase && congestionIncidents.length > 0 && (
          <motion.div
            className="glass ai-alert"
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 30 }}
            transition={{ delay: 0.4, type: 'spring', stiffness: 200, damping: 22 }}
          >
            <div className="aa-head">
              <WarnIcon style={{ width: 18, height: 18 }} />
              AI ALERT
            </div>
            <div className="aa-body">
              {congestionIncidents[0].description ?? 'Traffic incident detected near route.'}
            </div>
            <div className="aa-saved">
              <span style={{ color: 'var(--text-dim)', fontSize: 13 }}>Delay impact</span>
              <span className="v">+{congestionIncidents[0].delay_min} min</span>
            </div>
          </motion.div>
        )}

        {!isHospitalPhase && congestionIncidents.length === 0 && (
          <motion.div
            className="glass ai-alert"
            style={{ borderColor: 'rgba(34,197,94,0.5)', animation: 'none' }}
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <div className="aa-head" style={{ color: 'var(--success)' }}>
              <BoltIcon style={{ width: 18, height: 18 }} />
              ROUTE CLEAR
            </div>
            <div className="aa-body">No incidents detected on route to patient.</div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Legend */}
      <div className="glass map-legend">
        <div className="lg-row">
          <span className="swatch" style={{ background: routeColor }} />
          {isHospitalPhase ? 'Route to hospital' : 'Route to patient'}
        </div>
        {incidents.filter((i) => i.type === 'congestion').length > 0 && (
          <div className="lg-row">
            <span className="swatch" style={{ background: '#F59E0B' }} /> Congestion zone
          </div>
        )}
        {incidents.filter((i) => i.type === 'blockage').length > 0 && (
          <div className="lg-row">
            <span className="swatch" style={{ background: '#EF4444' }} /> Road blockage
          </div>
        )}
      </div>

      {/* Action bar */}
      <div className="reroute-bar">
        {triggerError && (
          <div style={{ color: 'var(--critical)', fontSize: 13, marginBottom: 8 }}>
            {triggerError}
          </div>
        )}
        {isHospitalPhase ? (
          <motion.button
            className="btn"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => navigate('/summary')}
          >
            <FlagIcon style={{ width: 18, height: 18 }} />
            Mark Patient Delivered
          </motion.button>
        ) : (
          <motion.button
            className="btn"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={handlePickedUp}
            disabled={triggering || !selectedAmbulance}
          >
            {triggering ? (
              <span className="spinner" style={{ marginRight: 8 }} />
            ) : (
              <BoltIcon style={{ width: 18, height: 18 }} />
            )}
            {triggering ? 'Computing hospital route…' : 'Patient Picked Up'}
          </motion.button>
        )}
      </div>
    </motion.div>
  )
}
