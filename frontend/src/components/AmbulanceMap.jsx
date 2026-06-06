import { MapContainer, TileLayer, Polyline, CircleMarker, Tooltip } from 'react-leaflet'

const DARK_TILES = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
const ATTR = '&copy; OpenStreetMap &copy; CARTO'

// Shows the patient (blue) and every ambulance, colour-coded by status.
// A dashed cyan line connects the selected/closest unit to the patient.
export default function AmbulanceMap({
  ambulances,
  selectedId,
  patientCoords = [6.5095, 3.3711],
  patientName = 'Patient',
}) {
  const selected = ambulances.find((a) => a.id === selectedId)

  return (
    <MapContainer center={patientCoords} zoom={14} scrollWheelZoom={true}>
      <TileLayer url={DARK_TILES} attribution={ATTR} subdomains="abcd" maxZoom={20} />

      {selected && (
        <Polyline
          positions={[selected.coords, patientCoords]}
          pathOptions={{ color: '#06B6D4', weight: 4, opacity: 0.9, dashArray: '4 8' }}
        />
      )}

      {ambulances.map((a) => {
        const isSel = a.id === selectedId
        const color = a.status === 'busy' || a.status === 'offline' ? '#64748B' : isSel ? '#06B6D4' : '#22C55E'
        return (
          <CircleMarker
            key={a.id}
            center={a.coords}
            radius={isSel ? 11 : 8}
            pathOptions={{
              color: '#fff',
              weight: isSel ? 3 : 1.5,
              fillColor: color,
              fillOpacity: a.status === 'available' ? 1 : 0.55,
            }}
          >
            <Tooltip direction="top" offset={[0, -8]}>
              {a.id} · {a.status !== 'available' ? a.status : `${a.distanceKm?.toFixed(1)} km`}
            </Tooltip>
          </CircleMarker>
        )
      })}

      <CircleMarker
        center={patientCoords}
        radius={10}
        pathOptions={{ color: '#fff', weight: 2, fillColor: '#3B82F6', fillOpacity: 1 }}
      >
        <Tooltip permanent direction="top" offset={[0, -10]}>
          Patient · {patientName}
        </Tooltip>
      </CircleMarker>
    </MapContainer>
  )
}
