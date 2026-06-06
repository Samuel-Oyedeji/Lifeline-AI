import { MapContainer, TileLayer, Polyline, CircleMarker, Tooltip } from 'react-leaflet'
import { PATIENT_LOCATION } from '../data/hospitals.js'

// Dark CARTO basemap (free, no API key) — matches the route map.
const DARK_TILES = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
const ATTR = '&copy; OpenStreetMap &copy; CARTO'

// Shows the patient (blue) and every ambulance, colour-coded by status.
// A dashed cyan line connects the selected/closest unit to the patient.
export default function AmbulanceMap({ ambulances, selectedId, patient = PATIENT_LOCATION }) {
  const selected = ambulances.find((a) => a.id === selectedId)

  return (
    <MapContainer center={patient.coords} zoom={14} scrollWheelZoom={true}>
      <TileLayer url={DARK_TILES} attribution={ATTR} subdomains="abcd" maxZoom={20} />

      {selected && (
        <Polyline
          positions={[selected.coords, patient.coords]}
          pathOptions={{ color: '#06B6D4', weight: 4, opacity: 0.9, dashArray: '4 8' }}
        />
      )}

      {ambulances.map((a) => {
        const isSel = a.id === selectedId
        const color = a.status === 'busy' ? '#64748B' : isSel ? '#06B6D4' : '#22C55E'
        return (
          <CircleMarker
            key={a.id}
            center={a.coords}
            radius={isSel ? 11 : 8}
            pathOptions={{
              color: '#fff',
              weight: isSel ? 3 : 1.5,
              fillColor: color,
              fillOpacity: a.status === 'busy' ? 0.55 : 1,
            }}
          >
            <Tooltip direction="top" offset={[0, -8]}>
              {a.id} · {a.status === 'busy' ? 'On call' : `${a.distanceKm.toFixed(1)} km`}
            </Tooltip>
          </CircleMarker>
        )
      })}

      {/* Patient */}
      <CircleMarker
        center={patient.coords}
        radius={10}
        pathOptions={{ color: '#fff', weight: 2, fillColor: '#3B82F6', fillOpacity: 1 }}
      >
        <Tooltip permanent direction="top" offset={[0, -10]}>
          Patient · {patient.name}
        </Tooltip>
      </CircleMarker>
    </MapContainer>
  )
}
