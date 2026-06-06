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
  const { selectedHospital } = useDispatch()
  const [rerouted, setRerouted] = useState(false)

  // Before reroute: only the red (current) route shows. Accepting the AI
  // reroute reveals the green path and flips the ETA.
  const currentEta = rerouted ? 8 : 13
  const predictedDelay = rerouted ? 1 : 5
  const timeSaved = 4

  return (
    <motion.div style={{ position: 'absolute', inset: 0 }} {...pageMotion}>
      <div className="map-wrap">
        <MapView hospital={selectedHospital} showRecommended={rerouted} showCurrent={true} />
      </div>

      {/* Floating metric cards (top-left) */}
      <div className="map-overlays">
        {[
          { k: 'Current ETA', v: `${currentEta} min`, c: '#fff' },
          { k: 'Predicted Delay', v: `+${predictedDelay} min`, c: 'var(--warning)' },
          { k: 'Time Saved', v: `${rerouted ? timeSaved : 0} min`, c: 'var(--success)' },
        ].map((card, i) => (
          <motion.div
            key={card.k}
            className="glass float-card"
            initial={{ opacity: 0, y: -14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 + i * 0.1 }}
          >
            <div className="fc-k">{card.k}</div>
            <div className="fc-v" style={{ color: card.c }}>
              {card.v}
            </div>
          </motion.div>
        ))}
      </div>

      {/* AI alert panel (right, pulsing) */}
      <AnimatePresence>
        {!rerouted && (
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
              Heavy congestion predicted on <strong>Ikorodu Road</strong> in{' '}
              <strong style={{ color: 'var(--warning)' }}>6 mins</strong>. Recommended reroute
              available.
            </div>
            <div className="aa-saved">
              <span style={{ color: 'var(--text-dim)', fontSize: 13 }}>Est. time saved</span>
              <span className="v">+4 min</span>
            </div>
            <motion.button
              className="btn"
              style={{ marginTop: 14, background: 'linear-gradient(135deg,#22C55E,#16a34a)' }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => setRerouted(true)}
            >
              <BoltIcon style={{ width: 18, height: 18 }} />
              Accept Reroute
            </motion.button>
          </motion.div>
        )}

        {rerouted && (
          <motion.div
            className="glass ai-alert"
            style={{ borderColor: 'rgba(34,197,94,0.5)', animation: 'none' }}
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <div className="aa-head" style={{ color: 'var(--success)' }}>
              <BoltIcon style={{ width: 18, height: 18 }} />
              REROUTED
            </div>
            <div className="aa-body">
              Ambulance now on the <strong style={{ color: 'var(--success)' }}>green</strong>{' '}
              predictive route — avoiding the Ikorodu Road jam before it forms.
            </div>
            <div className="aa-saved">
              <span style={{ color: 'var(--text-dim)', fontSize: 13 }}>Time saved</span>
              <span className="v">4 min</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Legend */}
      <div className="glass map-legend">
        <div className="lg-row">
          <span className="swatch" style={{ background: '#EF4444' }} /> Current route
        </div>
        <div className="lg-row">
          <span className="swatch" style={{ background: '#22C55E' }} /> Recommended reroute
        </div>
        <div className="lg-row">
          <span className="swatch" style={{ background: '#F59E0B' }} /> Predicted congestion
        </div>
      </div>

      {/* Continue to summary */}
      <div className="reroute-bar">
        <motion.button
          className="btn"
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => navigate('/summary')}
        >
          <FlagIcon style={{ width: 18, height: 18 }} />
          Mark Patient Delivered
        </motion.button>
      </div>
    </motion.div>
  )
}
