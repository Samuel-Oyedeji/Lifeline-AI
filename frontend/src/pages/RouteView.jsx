import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useDispatch } from '../context/DispatchContext.jsx'
import MapView from '../components/MapView.jsx'
import { WarnIcon, BoltIcon } from '../components/Icons.jsx'

function kmBetween(lat1, lng1, lat2, lng2) {
  const R = 6371, r = Math.PI / 180
  const dlat = (lat2 - lat1) * r, dlng = (lng2 - lng1) * r
  const a = Math.sin(dlat / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(dlng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

const pageMotion = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.5 },
}

export default function RouteView() {
  const {
    pickupRoute,
    hospitalRoute,
    pickupLatLng,
    selectedAmbulance,
    incidents,
  } = useDispatch()

  // Phase logic
  const isHospitalPhase = !!hospitalRoute

  // ── Route geometries ──────────────────────────────────────────────────────
  const pickupGeometry   = pickupRoute?.geometry
  const hospitalGeometry = hospitalRoute?.geometry

  // Primary = what we fit the map to on transition
  const primaryGeometry = isHospitalPhase ? hospitalGeometry : pickupGeometry

  // Colors
  const pickupColor   = '#EF4444'
  const hospitalColor = '#22C55E'

  // Metrics
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

  const pickupEtaMin = pickupRoute ? Math.round(pickupRoute.duration_s / 60) : '—'
  const pickupDistKm = pickupRoute ? (pickupRoute.distance_m / 1000).toFixed(1) : '—'

  const congestionIncidents = incidents.filter((i) => i.type === 'congestion')

  const ambulanceCoords = selectedAmbulance?.coords ?? null
  const ambulanceLabel  = selectedAmbulance?.id ?? 'Ambulance'

  // ── Nearby hospitals ─────────────────────────────────────────────────────────
  const [allHospitals, setAllHospitals] = useState([])
  useEffect(() => {
    fetch('/nigeria_hospitals.json')
      .then(r => r.json())
      .then(data => setAllHospitals(data.hospitals))
      .catch(() => {})
  }, [])

  const nearbyHospitals = useMemo(() => {
    if (!allHospitals.length || !pickupLatLng) return []
    const [clat, clng] = pickupLatLng
    return allHospitals
      .map(h => ({ ...h, km: kmBetween(clat, clng, h.lat, h.lng) }))
      .sort((a, b) => a.km - b.km)
      .slice(0, 20)
  }, [allHospitals, pickupLatLng])

  if (!primaryGeometry) {
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

  return (
    <motion.div style={{ position: 'absolute', inset: 0 }} {...pageMotion}>
      <div className="map-wrap">
        <MapView
          geometry={pickupGeometry}
          routeColor={pickupColor}
          secondaryGeometry={isHospitalPhase ? hospitalGeometry : undefined}
          secondaryColor={hospitalColor}
          patientCoords={pickupLatLng}
          hospital={isHospitalPhase ? hospitalRoute.destination : null}
          hospitals={nearbyHospitals}
          ambulanceCoords={ambulanceCoords}
          ambulanceLabel={ambulanceLabel}
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

        {isHospitalPhase && pickupRoute && (
          <motion.div
            className="glass float-card"
            initial={{ opacity: 0, y: -14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            style={{ borderColor: 'rgba(239,68,68,0.35)' }}
          >
            <div className="fc-k" style={{ color: '#EF4444' }}>Pickup Leg</div>
            <div className="fc-v" style={{ color: '#EF4444', fontSize: 13 }}>
              {pickupDistKm} km · {pickupEtaMin} min
            </div>
          </motion.div>
        )}

        {/* Hospital phase: show destination name */}
        {isHospitalPhase && (
          <motion.div
            className="glass float-card"
            initial={{ opacity: 0, y: -14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45 }}
            style={{ borderColor: 'rgba(34,197,94,0.35)' }}
          >
            <div className="fc-k" style={{ color: '#22C55E' }}>Hospital</div>
            <div className="fc-v" style={{ color: '#22C55E', fontSize: 13 }}>
              {hospitalRoute.destination.name}
            </div>
          </motion.div>
        )}
      </div>

      {/* Route legend */}
      <div className="glass map-legend">
        <div className="lg-row">
          <span className="swatch" style={{ background: pickupColor }} />
          Route to patient
        </div>
        {isHospitalPhase && (
          <div className="lg-row">
            <span className="swatch" style={{ background: hospitalColor }} />
            Route to hospital
          </div>
        )}
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

      {/* AI alert panel (right) — only during pickup phase */}
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

      {/* Status bar — read-only, driver controls all actions */}
      <div className="reroute-bar">
        {isHospitalPhase ? (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            color: '#22c55e', fontSize: 14,
            padding: '14px 0', justifyContent: 'center',
          }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', flexShrink: 0 }} />
            En route to {hospitalRoute.destination.name}
          </div>
        ) : (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            color: 'var(--text-dim)', fontSize: 14,
            padding: '14px 0', justifyContent: 'center',
          }}>
            <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2, flexShrink: 0 }} />
            Awaiting driver pickup confirmation…
          </div>
        )}
      </div>
    </motion.div>
  )
}
