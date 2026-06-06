import { PulseIcon } from './Icons.jsx'

export default function TopNav() {
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
        <span className="live-pill">
          <span className="dot" />
          LIVE · Lagos Grid
        </span>
        <div className="avatar">OP</div>
      </div>
    </header>
  )
}
