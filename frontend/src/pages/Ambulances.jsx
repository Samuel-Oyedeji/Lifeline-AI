import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { useDispatch } from '../context/DispatchContext.jsx'
import { PATIENT_LOCATION } from '../data/hospitals.js'
import { rankByDistance } from '../data/ambulances.js'
import AmbulanceMap from '../components/AmbulanceMap.jsx'
import { AmbulanceIcon, ClockIcon, PinIcon, BoltIcon, CheckIcon } from '../components/Icons.jsx'

const pageMotion = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
  transition: { duration: 0.4, ease: 'easeOut' },
}

export default function Ambulances() {
  const navigate = useNavigate()
  const { dispatch, setDispatch } = useDispatch()

  // Rank the whole fleet by real distance (haversine) to the patient.
  const fleet = useMemo(() => rankByDistance(PATIENT_LOCATION.coords), [])
  const closest = useMemo(() => fleet.find((a) => a.status === 'available'), [fleet])
  const maxKm = useMemo(() => Math.max(...fleet.map((a) => a.distanceKm)), [fleet])

  // Pre-select the closest available unit; operator can override.
  const [selectedId, setSelectedId] = useState(closest?.id ?? null)
  const selected = fleet.find((a) => a.id === selectedId) ?? closest

  const availableCount = fleet.filter((a) => a.status === 'available').length

  function dispatchUnit() {
    setDispatch((d) => ({ ...d, selectedAmbulanceId: selected.id }))
    navigate('/hospitals')
  }

  return (
    <motion.div className="scroll" {...pageMotion}>
      <div className="page-head">
        <span className="chip" style={{ marginBottom: 14 }}>
          <span className="dot" style={{ background: 'var(--secondary)' }} /> DISPATCH UNIT
        </span>
        <h1>
          Assign the <span className="grad-text">nearest ambulance</span>
        </h1>
        <p>
          {availableCount} units available · auto-matched to{' '}
          <strong style={{ color: '#fff' }}>{dispatch.patientLocation}</strong> by live distance.
        </p>
      </div>

      <div className="grid-2">
        {/* Closest unit recommendation */}
        <motion.div
          className="glass amb-reco"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <span className="label" style={{ color: 'var(--secondary)' }}>
              ★ Closest Available Unit
            </span>
            <span className="chip" style={{ color: 'var(--success)', borderColor: 'rgba(34,197,94,0.4)' }}>
              ● Available now
            </span>
          </div>

          <div className="amb-reco-head">
            <div className="amb-badge">
              <AmbulanceIcon style={{ width: 30, height: 30, color: 'var(--secondary)' }} />
            </div>
            <div>
              <div className="amb-id">{selected?.id}</div>
              <div className="amb-type">{selected?.type}</div>
            </div>
          </div>

          <div className="amb-reco-metrics">
            <div className="amb-metric">
              <div className="hm-k">
                <PinIcon style={{ width: 13, height: 13, verticalAlign: '-2px' }} /> Distance
              </div>
              <div className="hm-v">{selected?.distanceKm.toFixed(1)} km</div>
            </div>
            <div className="amb-metric">
              <div className="hm-k">
                <ClockIcon style={{ width: 13, height: 13, verticalAlign: '-2px' }} /> ETA to patient
              </div>
              <div className="hm-v" style={{ color: 'var(--success)' }}>
                {selected?.etaMin} min
              </div>
            </div>
            <div className="amb-metric">
              <div className="hm-k">Crew</div>
              <div className="hm-v" style={{ fontSize: 14 }}>{selected?.crew}</div>
            </div>
            <div className="amb-metric">
              <div className="hm-k">Plate</div>
              <div className="hm-v" style={{ fontSize: 14 }}>{selected?.plate}</div>
            </div>
          </div>

          <motion.button
            className="btn"
            style={{ marginTop: 4 }}
            whileHover={{ scale: 1.015 }}
            whileTap={{ scale: 0.98 }}
            onClick={dispatchUnit}
          >
            <BoltIcon style={{ width: 19, height: 19 }} />
            Dispatch {selected?.id}
          </motion.button>
        </motion.div>

        {/* Live fleet map */}
        <motion.div
          className="glass amb-map-card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <AmbulanceMap ambulances={fleet} selectedId={selected?.id} />
        </motion.div>
      </div>

      {/* Full fleet list */}
      <div className="label" style={{ margin: '26px 0 14px' }}>
        Fleet status · {fleet.length} units
      </div>
      <div className="grid-3">
        {fleet.map((a, i) => {
          const busy = a.status === 'busy'
          const isSel = a.id === selected?.id
          const proximity = Math.max(6, Math.round((1 - a.distanceKm / maxKm) * 100))
          return (
            <motion.div
              key={a.id}
              className={'glass amb-card' + (isSel ? ' sel' : '') + (busy ? ' busy' : '')}
              initial={{ opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12 + i * 0.07 }}
              whileHover={busy ? undefined : { y: -4 }}
              onClick={() => !busy && setSelectedId(a.id)}
              style={{ cursor: busy ? 'not-allowed' : 'pointer' }}
            >
              <div className="amb-card-head">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <AmbulanceIcon
                    style={{ width: 20, height: 20, color: busy ? 'var(--text-faint)' : 'var(--secondary)' }}
                  />
                  <span className="amb-card-id">{a.id}</span>
                </div>
                <span
                  className="chip"
                  style={{
                    color: busy ? 'var(--text-faint)' : 'var(--success)',
                    borderColor: busy ? 'var(--glass-border)' : 'rgba(34,197,94,0.4)',
                  }}
                >
                  {busy ? '● On call' : '● Available'}
                </span>
              </div>

              <div className="amb-card-sub">{a.type} · {a.crew}</div>

              <div className="amb-card-metrics">
                <div>
                  <span className="hm-k">Distance</span>
                  <div className="hm-v" style={{ fontSize: 16 }}>{a.distanceKm.toFixed(1)} km</div>
                </div>
                <div>
                  <span className="hm-k">ETA</span>
                  <div className="hm-v" style={{ fontSize: 16, color: busy ? 'var(--text-dim)' : 'var(--success)' }}>
                    {busy ? '—' : `${a.etaMin} min`}
                  </div>
                </div>
              </div>

              <div className="bar green">
                <motion.span
                  initial={{ width: 0 }}
                  animate={{ width: busy ? '0%' : `${proximity}%` }}
                  transition={{ duration: 0.9, delay: 0.2 + i * 0.07 }}
                />
              </div>

              <button
                className={'btn ' + (isSel ? '' : 'btn-ghost')}
                disabled={busy}
                onClick={(e) => {
                  e.stopPropagation()
                  if (!busy) setSelectedId(a.id)
                }}
              >
                {isSel ? (
                  <>
                    <CheckIcon style={{ width: 17, height: 17 }} /> Selected
                  </>
                ) : busy ? (
                  'Unavailable'
                ) : (
                  'Select Unit'
                )}
              </button>
            </motion.div>
          )
        })}
      </div>
    </motion.div>
  )
}
