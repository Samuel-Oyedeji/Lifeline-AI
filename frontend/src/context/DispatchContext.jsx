import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { AMBULANCES } from '../data/ambulances.js'
import { PATIENT_LOCATION } from '../data/hospitals.js'

const DispatchContext = createContext(null)

export function DispatchProvider({ children }) {
  const navigate = useNavigate()
  const location = useLocation()

  // ── Form state ──────────────────────────────────────────────────────────────
  const [dispatch, setDispatch] = useState({
    patientLocation: PATIENT_LOCATION.name,
    emergencyType: 'cardiac',
    priority: 'critical',
    selectedAmbulanceId: null,
  })

  // Pickup point (lat/lng) — set by clicking the map on the Dispatch page
  const [pickupLatLng, setPickupLatLng] = useState(PATIENT_LOCATION.coords)

  // ── Live fleet ──────────────────────────────────────────────────────────────
  // Starts from local metadata; WS positions + backend ID list update it.
  const [liveAmbulances, setLiveAmbulances] = useState(AMBULANCES)

  // ── WS message payloads ─────────────────────────────────────────────────────
  const [pickupRoute,     setPickupRoute]     = useState(null)  // `route` message
  const [preHospitalData, setPreHospitalData] = useState(null)  // `pre_hospital_routes` message
  const [hospitalRoute,   setHospitalRoute]   = useState(null)  // `hospital_route` message
  const [incidents,    setIncidents]    = useState([])
  const [wsStatus,     setWsStatus]     = useState('connecting')

  // ── Hydrate fleet from backend ID list ──────────────────────────────────────
  useEffect(() => {
    fetch('/ambulances')
      .then(r => r.json())
      .then(data => {
        const backendIds = new Set(data.ambulances.map(a => a.id))
        // Keep all 6 units but mark offline those not registered in backend
        setLiveAmbulances(prev =>
          prev.map(a => backendIds.has(a.id) ? a : { ...a, status: 'offline' })
        )
      })
      .catch(() => {}) // fall back to local metadata on network error
  }, [])

  // ── WebSocket: /ws/dispatch ─────────────────────────────────────────────────
  const navigateRef = useRef(navigate)
  const locationRef = useRef(location)
  useEffect(() => { navigateRef.current = navigate })
  useEffect(() => { locationRef.current = location })

  // Don't redirect when the ambulance driver page is open — it manages its
  // own WebSocket (/ws/ambulance/:id) and its own route display in-place.
  function safeNavigate(path) {
    if (locationRef.current.pathname === '/ambulance') return
    navigateRef.current(path)
  }

  useEffect(() => {
    let ws
    let timer

    function connect() {
      ws = new WebSocket(`ws://${window.location.host}/ws/dispatch`)

      ws.onopen = () => setWsStatus('connected')

      ws.onmessage = (evt) => {
        const msg = JSON.parse(evt.data)

        if (msg.type === 'snapshot') {
          // Merge live positions into fleet
          setLiveAmbulances(prev =>
            prev.map(a => {
              const live = msg.ambulances.find(x => x.ambulance_id === a.id)
              return live ? { ...a, coords: [live.lat, live.lng] } : a
            })
          )
        } else if (msg.type === 'position') {
          setLiveAmbulances(prev =>
            prev.map(a =>
              a.id === msg.ambulance_id ? { ...a, coords: [msg.lat, msg.lng] } : a
            )
          )
        } else if (msg.type === 'route') {
          setPickupRoute(msg)
          safeNavigate('/route')
        } else if (msg.type === 'pre_hospital_routes') {
          setPreHospitalData(msg)
        } else if (msg.type === 'hospital_route') {
          setHospitalRoute(msg)
          safeNavigate('/hospitals')
        } else if (msg.type === 'incident_snapshot') {
          setIncidents(msg.incidents)
        }
      }

      ws.onclose = ws.onerror = () => {
        setWsStatus('reconnecting')
        timer = setTimeout(connect, 2000)
      }
    }

    connect()
    return () => {
      clearTimeout(timer)
      ws?.close()
    }
  }, []) // open once on mount; navigateRef handles stale-navigate

  // ── Derived ─────────────────────────────────────────────────────────────────
  const selectedAmbulance = useMemo(
    () => liveAmbulances.find(a => a.id === dispatch.selectedAmbulanceId) ?? null,
    [liveAmbulances, dispatch.selectedAmbulanceId]
  )

  const value = useMemo(() => ({
    dispatch, setDispatch,
    pickupLatLng, setPickupLatLng,
    liveAmbulances,
    pickupRoute,  setPickupRoute,
    preHospitalData, setPreHospitalData,
    hospitalRoute, setHospitalRoute,
    incidents,
    wsStatus,
    selectedAmbulance,
  }), [
    dispatch, pickupLatLng, liveAmbulances,
    pickupRoute, preHospitalData, hospitalRoute, incidents, wsStatus, selectedAmbulance,
  ])

  return <DispatchContext.Provider value={value}>{children}</DispatchContext.Provider>
}

export function useDispatch() {
  const ctx = useContext(DispatchContext)
  if (!ctx) throw new Error('useDispatch must be used within DispatchProvider')
  return ctx
}
