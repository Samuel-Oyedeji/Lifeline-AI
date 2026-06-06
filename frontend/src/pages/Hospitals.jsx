import { useState } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { useDispatch } from '../context/DispatchContext.jsx'
import { CheckIcon, ClockIcon, RouteIcon, WarnIcon } from '../components/Icons.jsx'
import MapView from '../components/MapView.jsx'

const pageMotion = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
  transition: { duration: 0.4, ease: 'easeOut' },
}

function ScoreRing({ score }) {
  const R = 58
  const C = 2 * Math.PI * R
  const offset = C * (1 - score / 100)
  return (
    <div className="score-ring">
      <svg width="132" height="132">
        <circle cx="66" cy="66" r={R} stroke="rgba(255,255,255,0.08)" strokeWidth="9" fill="none" />
        <motion.circle
          cx="66"
          cy="66"
          r={R}
          stroke="#22C55E"
          strokeWidth="9"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={C}
          initial={{ strokeDashoffset: C }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.1, ease: 'easeOut', delay: 0.2 }}
          style={{ filter: 'drop-shadow(0 0 8px rgba(34,197,94,0.8))' }}
        />
      </svg>
      <div style={{ textAlign: 'center' }}>
        <div className="score-num">{score}</div>
        <div className="score-den">/ 100</div>
      </div>
    </div>
  )
}

export default function Hospitals() {
  const navigate = useNavigate()
  const { hospitalRoute, pickupRoute, preHospitalData, pickupLatLng, selectedAmbulance, incidents } = useDispatch()

  // Route toggles
  const [showPickup,       setShowPickup]       = useState(true)
  const [showPickupToHosp, setShowPickupToHosp] = useState(true)
  const [showAmbToHosp,    setShowAmbToHosp]    = useState(true)

  if (!hospitalRoute) {
    return (
      <motion.div className="scroll" {...pageMotion}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '60vh',
            flexDirection: 'column',
            gap: 20,
          }}
        >
          <span className="spinner" style={{ width: 40, height: 40 }} />
          <p style={{ color: 'var(--text-dim)' }}>Computing best hospital…</p>
        </div>
      </motion.div>
    )
  }

  const { destination, effective_duration_s, distance_m, security_recommendation, alternatives } =
    hospitalRoute
  const etaMin = Math.round(effective_duration_s / 60)
  const distanceKm = (distance_m / 1000).toFixed(1)
  const secRec = security_recommendation?.recommended

  const prePickupToHosp = preHospitalData?.pickup_to_hospital
  const preAmbToHosp    = preHospitalData?.ambulance_to_hospital

  return (
    <motion.div className="scroll" {...pageMotion} style={{ overflowX: 'hidden' }}>
      <div className="page-head">
        <span className="chip" style={{ marginBottom: 14 }}>
          <span className="dot" style={{ background: 'var(--success)' }} /> AI RECOMMENDATION
        </span>
        <h1>
          Best hospital for this <span className="grad-text">patient</span>
        </h1>
        <p>Ranked by live ETA and predicted incident delay on each route.</p>
      </div>

      <div className="grid-2">
        <div className="stack">
          {/* Security detail banner */}
          {secRec && (
            <motion.div
              className="glass"
              style={{
                padding: '14px 18px',
                border: '1px solid rgba(245,158,11,0.6)',
                borderRadius: 12,
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                color: '#F59E0B',
              }}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <WarnIcon style={{ width: 20, height: 20, flexShrink: 0 }} />
              <span>
                <strong>Security Detail Recommended</strong> — Clearable congestion on fastest route.{' '}
                ~{Math.round(security_recommendation.estimated_time_saved_s / 60)} min could be saved
                with escort.
              </span>
            </motion.div>
          )}

          {/* Top recommendation card */}
          <motion.div
            className="glass reco-top"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="reco-grid">
              <ScoreRing score={95} />
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <span className="label" style={{ color: 'var(--success)' }}>
                    ★ Top Match
                  </span>
                  <span
                    className="chip"
                    style={{ color: 'var(--success)', borderColor: 'rgba(34,197,94,0.4)' }}
                  >
                    {etaMin} min ETA
                  </span>
                </div>
                <h2 style={{ fontSize: 26, marginTop: 8 }}>{destination.name}</h2>
                <div className="reasons">
                  {[
                    `${distanceKm} km from pickup point`,
                    `Effective ETA: ${etaMin} min (including delays)`,
                    'Fastest available route selected by AI',
                  ].map((r, i) => (
                    <motion.div
                      key={r}
                      className="reason"
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.3 + i * 0.1 }}
                    >
                      <CheckIcon className="tick" style={{ width: 18, height: 18 }} />
                      {r}
                    </motion.div>
                  ))}
                </div>
                <motion.button
                  className="btn"
                  style={{ width: 'auto', marginTop: 22, padding: '13px 24px' }}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => navigate('/route')}
                >
                  <RouteIcon style={{ width: 18, height: 18 }} />
                  View Predictive Route
                </motion.button>
              </div>
            </div>
          </motion.div>

          {/* Alternatives */}
          {alternatives?.length > 0 && (
            <>
              <div className="label" style={{ margin: '10px 0 2px' }}>
                Other hospitals evaluated
              </div>
              <div className="grid-3" style={{ gridTemplateColumns: '1fr 1fr' }}>
                {alternatives.map((alt, i) => (
                  <motion.div
                    key={alt.name}
                    className="glass hosp-card"
                    initial={{ opacity: 0, y: 24 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 + i * 0.1 }}
                    whileHover={{ y: -4 }}
                  >
                    <div className="hosp-head">
                      <div className="hosp-name">{alt.name}</div>
                    </div>
                    <div className="hosp-metrics">
                      <div className="hosp-metric">
                        <div className="hm-k">
                          <ClockIcon style={{ width: 13, height: 13, verticalAlign: '-2px' }} /> ETA
                        </div>
                        <div className="hm-v">{Math.round(alt.effective_duration_s / 60)} min</div>
                      </div>
                      <div className="hosp-metric">
                        <div className="hm-k">Base time</div>
                        <div className="hm-v">{Math.round(alt.duration_s / 60)} min</div>
                      </div>
                    </div>
                    <div>
                      <div className="score-line">
                        <div className="bar green" style={{ flex: 1 }}>
                          <motion.span
                            initial={{ width: 0 }}
                            animate={{
                              width: `${Math.round(
                                (etaMin / Math.round(alt.effective_duration_s / 60)) * 80
                              )}%`,
                            }}
                            transition={{ duration: 1, delay: 0.3 + i * 0.1 }}
                          />
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Right column — Map + Switches */}
        <div style={{ position: 'relative', height: 'calc(100vh - 170px)', borderRadius: 18, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
          <MapView
            geometry={showPickup ? pickupRoute?.geometry : undefined}
            routeColor="#EF4444"
            secondaryGeometry={showPickupToHosp ? (prePickupToHosp?.geometry ?? hospitalRoute?.geometry) : undefined}
            secondaryColor="#22C55E"
            tertiaryGeometry={showAmbToHosp ? preAmbToHosp?.geometry : undefined}
            tertiaryColor="#F59E0B"
            patientCoords={pickupLatLng}
            hospital={destination}
            ambulanceCoords={selectedAmbulance?.coords}
            ambulanceLabel={selectedAmbulance?.id}
            incidents={incidents}
          />

          {/* Route toggles overlay */}
          <div style={{
            position: 'absolute', bottom: 12, left: 12,
            background: 'rgba(11,16,32,0.93)',
            border: '1px solid rgba(255,255,255,0.10)',
            borderRadius: 14, padding: '12px 14px',
            backdropFilter: 'blur(20px)',
            zIndex: 500, width: 230,
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
              },
              {
                color: '#22C55E',
                label: `Pickup → Hospital`,
                sub: prePickupToHosp
                  ? `${(prePickupToHosp.distance_m/1000).toFixed(1)} km · ${Math.round(prePickupToHosp.effective_duration_s/60)} min`
                  : hospitalRoute
                  ? `${(hospitalRoute.distance_m/1000).toFixed(1)} km · ${Math.round(hospitalRoute.effective_duration_s/60)} min`
                  : null,
                active: showPickupToHosp,
                toggle: () => setShowPickupToHosp(v => !v),
              },
              {
                color: '#F59E0B',
                label: 'Ambulance → Hospital',
                sub: preAmbToHosp
                  ? `${(preAmbToHosp.distance_m/1000).toFixed(1)} km · ${Math.round(preAmbToHosp.duration_s/60)} min`
                  : null,
                active: showAmbToHosp,
                toggle: () => setShowAmbToHosp(v => !v),
              },
            ].map((row) => (
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
                  {row.sub && (
                    <div style={{ fontSize: 10, color: '#64748b' }}>{row.sub}</div>
                  )}
                </div>
                <div
                  onClick={row.toggle}
                  style={{
                    width: 32, height: 17, borderRadius: 9, flexShrink: 0,
                    background: row.active ? row.color : 'rgba(255,255,255,0.12)',
                    cursor: 'pointer', position: 'relative',
                    transition: 'background 0.2s',
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
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  )
}
