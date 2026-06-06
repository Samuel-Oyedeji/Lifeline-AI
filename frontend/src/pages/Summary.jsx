import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { useDispatch } from '../context/DispatchContext.jsx'
import { EMERGENCY_TYPES, PRIORITIES } from '../data/hospitals.js'
import { CheckIcon } from '../components/Icons.jsx'

const pageMotion = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
  transition: { duration: 0.4, ease: 'easeOut' },
}

const SPARK_COLORS = ['#3B82F6', '#06B6D4', '#22C55E', '#F59E0B', '#EF4444']

const SPARKS = Array.from({ length: 22 }, (_, i) => ({
  left: (i * 4.6 + 4) % 100,
  delay: (i % 7) * 0.12,
  color: SPARK_COLORS[i % SPARK_COLORS.length],
  drift: ((i % 5) - 2) * 16,
}))

export default function Summary() {
  const navigate = useNavigate()
  const { dispatch, selectedAmbulance, pickupRoute, hospitalRoute } = useDispatch()

  const emergency = EMERGENCY_TYPES.find((e) => e.id === dispatch.emergencyType)
  const priority = PRIORITIES.find((p) => p.id === dispatch.priority)

  const hospitalName = hospitalRoute?.destination?.name ?? 'Hospital'
  const pickupEta = pickupRoute ? Math.round(pickupRoute.duration_s / 60) : '—'
  const hospitalEta = hospitalRoute ? Math.round(hospitalRoute.effective_duration_s / 60) : '—'
  const totalDistKm = hospitalRoute
    ? ((pickupRoute?.distance_m ?? 0) / 1000 + hospitalRoute.distance_m / 1000).toFixed(1)
    : '—'

  const metrics = [
    { k: 'Hospital Selected', v: hospitalName, c: '#fff' },
    { k: 'Pickup ETA', v: `${pickupEta} min`, c: 'var(--success)' },
    { k: 'Hospital ETA', v: `${hospitalEta} min`, c: 'var(--warning)' },
    { k: 'Patient Priority', v: priority?.label ?? 'Critical', c: priority?.color },
  ]

  return (
    <motion.div className="scroll" {...pageMotion}>
      <div className="summary-wrap">
        {/* Success hero */}
        <motion.div
          className="glass success-hero"
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 22 }}
        >
          {/* Confetti sparks */}
          {SPARKS.map((s, i) => (
            <motion.span
              key={i}
              className="spark"
              style={{ left: `${s.left}%`, background: s.color }}
              initial={{ y: -10, opacity: 0 }}
              animate={{ y: 360, x: s.drift, opacity: [0, 1, 1, 0], rotate: 220 }}
              transition={{
                duration: 2.4,
                delay: s.delay,
                ease: 'easeIn',
                repeat: Infinity,
                repeatDelay: 1.4,
              }}
            />
          ))}

          <motion.div
            className="success-badge"
            initial={{ scale: 0, rotate: -30 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 16, delay: 0.15 }}
          >
            <CheckIcon style={{ width: 46, height: 46, color: 'var(--success)' }} />
          </motion.div>

          <h1>
            Patient <span className="grad-text">Delivered</span>
          </h1>
          <p>
            {emergency?.label ?? 'Emergency'} routed to {hospitalName} with predictive routing.
            Total distance: {totalDistKm} km.
          </p>
          {selectedAmbulance && (
            <span
              className="chip"
              style={{
                marginTop: 14,
                color: 'var(--secondary)',
                borderColor: 'rgba(6,182,212,0.4)',
              }}
            >
              🚑 Unit {selectedAmbulance.id} · {selectedAmbulance.type}
            </span>
          )}

          <div className="summary-metrics">
            {metrics.map((m, i) => (
              <motion.div
                key={m.k}
                className="glass stat"
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + i * 0.1 }}
              >
                <div className="stat-k">{m.k}</div>
                <div className="stat-v" style={{ color: m.c, fontSize: 24 }}>
                  {m.v}
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Impact recap */}
        <motion.div
          className="glass card"
          style={{ marginTop: 22 }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <span className="label">Operational learning</span>
          <p style={{ color: 'var(--text-dim)', fontSize: 14.5, lineHeight: 1.7, marginTop: 12 }}>
            This run is logged to the historical traffic model. LifeLine AI uses every delivered
            mission to sharpen future congestion forecasts — improving readiness across the Lagos
            grid with each dispatch.
          </p>
          <div style={{ display: 'flex', gap: 12, marginTop: 18, flexWrap: 'wrap' }}>
            <motion.button
              className="btn"
              style={{ width: 'auto', padding: '13px 24px' }}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => navigate('/')}
            >
              New Dispatch
            </motion.button>
            <button
              className="btn btn-ghost"
              style={{ width: 'auto', padding: '13px 24px' }}
              onClick={() => navigate('/route')}
            >
              Replay Route
            </button>
          </div>
        </motion.div>
      </div>
    </motion.div>
  )
}
