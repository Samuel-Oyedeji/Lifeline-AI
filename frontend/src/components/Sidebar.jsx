import { NavLink } from 'react-router-dom'
import { DispatchIcon, HospitalIcon, RouteIcon, FlagIcon } from './Icons.jsx'

const NAV = [
  { to: '/', label: 'Emergency Dispatch', step: '01', Icon: DispatchIcon, end: true },
  { to: '/hospitals', label: 'Recommended Hospital', step: '02', Icon: HospitalIcon },
  { to: '/route', label: 'Predictive Route', step: '03', Icon: RouteIcon },
  { to: '/summary', label: 'Mission Summary', step: '04', Icon: FlagIcon },
]

export default function Sidebar() {
  return (
    <aside className="sidebar">
      {NAV.map(({ to, label, step, Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}
        >
          <span className="ico">
            <Icon />
          </span>
          <span className="nav-label">{label}</span>
          <span className="nav-step">{step}</span>
        </NavLink>
      ))}

      <div className="sidebar-foot">
        <strong style={{ color: 'var(--text-dim)' }}>Operator Console</strong>
        <br />
        Lagos Emergency Grid · v1.0
        <br />
        AWS · S3 · Lambda · DynamoDB
      </div>
    </aside>
  )
}
