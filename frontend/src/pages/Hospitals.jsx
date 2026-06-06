import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { useDispatch } from '../context/DispatchContext.jsx'
import { HOSPITALS } from '../data/hospitals.js'
import { CheckIcon, ClockIcon, BedIcon, RouteIcon } from '../components/Icons.jsx'

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
  const { setDispatch } = useDispatch()
  const best = HOSPITALS[0]

  function pick(id) {
    setDispatch((d) => ({ ...d, selectedHospitalId: id }))
    navigate('/route')
  }

  return (
    <motion.div className="scroll" {...pageMotion}>
      <div className="page-head">
        <span className="chip" style={{ marginBottom: 14 }}>
          <span className="dot" style={{ background: 'var(--success)' }} /> AI RECOMMENDATION
        </span>
        <h1>
          Best hospital for this <span className="grad-text">patient</span>
        </h1>
        <p>Ranked by ICU & bed availability, specialist match, live ETA and predicted delay.</p>
      </div>

      {/* Top recommendation card */}
      <motion.div
        className="glass reco-top"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="reco-grid">
          <ScoreRing score={best.score} />
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <span className="label" style={{ color: 'var(--success)' }}>
                ★ Top Match
              </span>
              <span
                className="chip"
                style={{ color: 'var(--success)', borderColor: 'rgba(34,197,94,0.4)' }}
              >
                4 min faster
              </span>
            </div>
            <h2 style={{ fontSize: 26, marginTop: 8 }}>{best.name}</h2>
            <div className="reasons">
              {best.reasons.map((r, i) => (
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
              onClick={() => pick(best.id)}
            >
              <RouteIcon style={{ width: 18, height: 18 }} />
              View Predictive Route
            </motion.button>
          </div>
        </div>
      </motion.div>

      {/* Comparison cards */}
      <div className="label" style={{ margin: '26px 0 14px' }}>
        All evaluated hospitals
      </div>
      <div className="grid-3">
        {HOSPITALS.map((h, i) => (
          <motion.div
            key={h.id}
            className={'glass hosp-card' + (h.id === best.id ? ' best' : '')}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 + i * 0.1 }}
            whileHover={{ y: -4 }}
          >
            <div className="hosp-head">
              <div className="hosp-name">{h.name}</div>
              {h.id === best.id && (
                <span
                  className="chip"
                  style={{ color: 'var(--success)', borderColor: 'rgba(34,197,94,0.4)' }}
                >
                  Best
                </span>
              )}
            </div>

            <div className="hosp-metrics">
              <div className="hosp-metric">
                <div className="hm-k">
                  <ClockIcon style={{ width: 13, height: 13, verticalAlign: '-2px' }} /> ETA
                </div>
                <div className="hm-v">{h.etaMin} min</div>
              </div>
              <div className="hosp-metric">
                <div className="hm-k">
                  <BedIcon style={{ width: 13, height: 13, verticalAlign: '-2px' }} /> Beds
                </div>
                <div className="hm-v">{h.bedsAvailable}</div>
              </div>
              <div className="hosp-metric">
                <div className="hm-k">ICU</div>
                <div className="hm-v" style={{ color: h.icu ? 'var(--success)' : 'var(--critical)' }}>
                  {h.icu ? 'Available' : 'Full'}
                </div>
              </div>
              <div className="hosp-metric">
                <div className="hm-k">Pred. delay</div>
                <div
                  className="hm-v"
                  style={{ color: h.predictedDelayMin <= 2 ? 'var(--success)' : 'var(--warning)' }}
                >
                  +{h.predictedDelayMin} min
                </div>
              </div>
            </div>

            <div>
              <div className="hm-k" style={{ marginBottom: 6 }}>
                Specialists
              </div>
              <div className="spec-tags">
                {h.specialists.map((s) => (
                  <span key={s} className="spec-tag">
                    {s}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <div className="score-line">
                <div className="bar green" style={{ flex: 1 }}>
                  <motion.span
                    initial={{ width: 0 }}
                    animate={{ width: `${h.score}%` }}
                    transition={{ duration: 1, delay: 0.3 + i * 0.1 }}
                  />
                </div>
                <span className="sl-num">{h.score}</span>
              </div>
            </div>

            <button
              className={'btn ' + (h.id === best.id ? '' : 'btn-ghost')}
              style={{ marginTop: 4 }}
              onClick={() => pick(h.id)}
            >
              {h.id === best.id ? 'Route Here' : 'Select'}
            </button>
          </motion.div>
        ))}
      </div>
    </motion.div>
  )
}
