import { PulseIcon } from './Icons.jsx'
import { useDispatch } from '../context/DispatchContext.jsx'

const PILL_CONFIG = {
  connected:    { label: 'LIVE · Lagos Grid',         cls: 'live-pill--connected' },
  connecting:   { label: 'CONNECTING · Lagos Grid',   cls: 'live-pill--connecting' },
  reconnecting: { label: 'RECONNECTING · Lagos Grid', cls: 'live-pill--reconnecting' },
}

export default function TopNav() {
  const { wsStatus } = useDispatch()
  const { label, cls } = PILL_CONFIG[wsStatus] ?? PILL_CONFIG.connecting

  return (
    <header className="topnav">
      <div className="brand">
        <div className="brand-mark">
          <PulseIcon style={{ color: '#fff', width: 22, height: 22 }} />
        </div>
        <div>
          <div className="brand-name">
            LifeLine <span style={{ color: 'var(--secondary)' }}>AI</span>
          </div>
          <div className="brand-tag">Predict. Route. Save Lives.</div>
        </div>
      </div>

      <div className="topnav-right">
        <span className={`live-pill ${cls}`}>
          <span className="dot" />
          <span className="live-pill-label">{label}</span>
        </span>
        <span className="topnav-sep" />
        <div className="avatar-wrap">
          <div className="avatar">OP</div>
          <span className="avatar-online" />
        </div>
      </div>
    </header>
  )
}
