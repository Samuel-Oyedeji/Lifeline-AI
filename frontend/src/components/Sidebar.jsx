import { NavLink } from 'react-router-dom'
import { DispatchIcon, AmbulanceIcon, HospitalIcon, RouteIcon, FlagIcon } from './Icons.jsx'

const NAV = [
  { to: '/', label: 'Emergency Details', step: '01', Icon: DispatchIcon, end: true },
  { to: '/ambulances', label: 'Assign Unit', step: '02', Icon: AmbulanceIcon },
  { to: '/route', label: 'Route to Patient', step: '03', Icon: RouteIcon },
  // { to: '/hospitals', label: 'Hospital Recommendation', step: '04', Icon: HospitalIcon },
  { to: '/summary', label: 'Mission Complete', step: '05', Icon: FlagIcon },
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

    </aside>
  )
}
