import { createContext, useContext, useMemo, useState } from 'react'
import { HOSPITALS } from '../data/hospitals.js'

const DispatchContext = createContext(null)

export function DispatchProvider({ children }) {
  const [dispatch, setDispatch] = useState({
    patientLocation: 'Yaba, Lagos',
    emergencyType: 'cardiac',
    priority: 'critical',
    selectedHospitalId: 'luth',
  })

  const selectedHospital = useMemo(
    () => HOSPITALS.find((h) => h.id === dispatch.selectedHospitalId) ?? HOSPITALS[0],
    [dispatch.selectedHospitalId]
  )

  const value = useMemo(
    () => ({ dispatch, setDispatch, selectedHospital }),
    [dispatch, selectedHospital]
  )

  return <DispatchContext.Provider value={value}>{children}</DispatchContext.Provider>
}

export function useDispatch() {
  const ctx = useContext(DispatchContext)
  if (!ctx) throw new Error('useDispatch must be used within DispatchProvider')
  return ctx
}
