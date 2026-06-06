import { NavLink } from 'react-router-dom'
import { DispatchIcon, AmbulanceIcon, HospitalIcon, RouteIcon, FlagIcon } from './Icons.jsx'

const NAV = [
  { to: '/', label: 'Emergency Dispatch', step: '01', Icon: DispatchIcon, end: true },
  { to: '/ambulances', label: 'Dispatch Ambulance', step: '02', Icon: AmbulanceIcon },
  { to: '/hospitals', label: 'Recommended Hospital', step: '03', Icon: HospitalIcon },
  { to: '/route', label: 'Predictive Route', step: '04', Icon: RouteIcon },
  { to: '/summary', label: 'Mission Summary', step: '05', Icon: FlagIcon },
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
