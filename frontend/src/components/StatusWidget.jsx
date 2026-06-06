import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { PulseIcon } from './Icons.jsx'

// Floating enterprise-style status widget (top-right).
// Numbers tick gently to feel like a live system.
export default function StatusWidget() {
  const [predictions, setPredictions] = useState(23)

  useEffect(() => {
    const t = setInterval(() => {
      setPredictions((p) => {
        const next = p + (Math.random() > 0.5 ? 1 : -1)
        return Math.max(18, Math.min(31, next))
      })
    }, 2200)
    return () => clearInterval(t)
  }, [])

  return (
    <motion.div
      className="glass status-widget"
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3, duration: 0.5 }}
    >
      <div className="sw-head">
        <PulseIcon style={{ color: 'var(--secondary)', width: 18, height: 18 }} />
        <span className="sw-title">LifeLine AI</span>
      </div>

      <div className="sw-row">
        <span className="k">System Status</span>
        <span className="v" style={{ color: 'var(--success)' }}>
          ● Online
        </span>
      </div>
      <div className="sw-row">
        <span className="k">Predictions Running</span>
        <span className="v" style={{ color: 'var(--secondary)' }}>
          {predictions}
        </span>
      </div>
      <div className="sw-row">
        <span className="k">Hospitals Monitored</span>
        <span className="v">15</span>
      </div>
    </motion.div>
  )
}
