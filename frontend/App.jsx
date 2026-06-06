import { Routes, Route } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { useLocation } from 'react-router-dom'

import TopNav from './components/TopNav.jsx'
import Sidebar from './components/Sidebar.jsx'
import StatusWidget from './components/StatusWidget.jsx'

import Dispatch from './pages/Dispatch.jsx'
import Ambulances from './pages/Ambulances.jsx'
import Hospitals from './pages/Hospitals.jsx'
import RouteView from './pages/RouteView.jsx'
import Summary from './pages/Summary.jsx'

export default function App() {
  const location = useLocation()
  // Hide the floating widget on the full-bleed map page so it doesn't
  // collide with the AI alert panel.
  const onRoutePage = location.pathname.startsWith('/route')

  return (
    <div className="shell">
      <TopNav />
      <Sidebar />
      <main className="main">
        <AnimatePresence mode="wait">
          <Routes location={location} key={location.pathname}>
            <Route path="/" element={<Dispatch />} />
            <Route path="/ambulances" element={<Ambulances />} />
            <Route path="/hospitals" element={<Hospitals />} />
            <Route path="/route" element={<RouteView />} />
            <Route path="/summary" element={<Summary />} />
          </Routes>
        </AnimatePresence>
      </main>
      {!onRoutePage && <StatusWidget />}
    </div>
  )
}
