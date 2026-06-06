import { Routes, Route } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { useLocation } from 'react-router-dom'

import TopNav from './components/TopNav.jsx'
import Sidebar from './components/Sidebar.jsx'

import Dispatch from './pages/Dispatch.jsx'
import Ambulances from './pages/Ambulances.jsx'
import Hospitals from './pages/Hospitals.jsx'
import RouteView from './pages/RouteView.jsx'
import Summary from './pages/Summary.jsx'
import AmbulancePage from './pages/AmbulancePage.jsx'

export default function App() {
  const location = useLocation()

  // Ambulance driver page — full-screen, no operator shell
  if (location.pathname === '/ambulance') {
    return (
      <Routes>
        <Route path="/ambulance" element={<AmbulancePage />} />
      </Routes>
    )
  }

  return (
    <div className="shell">
      <TopNav />
      <Sidebar />
      <main className="main">
        <AnimatePresence mode="wait">
          <Routes location={location} key={location.pathname}>
            <Route path="/" element={<Dispatch />} />
            <Route path="/ambulances" element={<Ambulances />} />
            <Route path="/route" element={<RouteView />} />
            <Route path="/hospitals" element={<Hospitals />} />
            <Route path="/summary" element={<Summary />} />
          </Routes>
        </AnimatePresence>
      </main>

    </div>
  )
}
