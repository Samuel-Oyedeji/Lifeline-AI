import { useEffect } from 'react'
import { MapContainer, TileLayer, Polyline, Circle, CircleMarker, Tooltip, useMap } from 'react-leaflet'

const DARK_TILES = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
const ATTR = '&copy; OpenStreetMap &copy; CARTO'

function FitRoute({ positions }) {
  const map = useMap()
  useEffect(() => {
    if (positions?.length > 1) {
      map.fitBounds(positions, { padding: [40, 40] })
    }
  }, [positions, map])
  return null
}

export default function MapView({
  geometry,
  routeColor = '#22C55E',
  patientCoords,
  hospital,
  incidents = [],
}) {
  const center = patientCoords ?? [6.5095, 3.3711]

  return (
    <MapContainer center={center} zoom={14} zoomControl={true} scrollWheelZoom={true} attributionControl={true}>
      <TileLayer url={DARK_TILES} attribution={ATTR} subdomains="abcd" maxZoom={20} />

      {geometry?.length > 1 && (
        <>
          <FitRoute positions={geometry} />
          <Polyline
            positions={geometry}
            pathOptions={{ color: routeColor, weight: 6, opacity: 0.95 }}
          />
        </>
      )}

      {incidents.map((inc) => (
        <Circle
          key={inc.id}
          center={[inc.lat, inc.lng]}
          radius={inc.radius_m}
          pathOptions={{
            color: inc.type === 'blockage' ? '#EF4444' : '#F59E0B',
            weight: 1,
            fillColor: inc.type === 'blockage' ? '#EF4444' : '#F59E0B',
            fillOpacity: 0.18,
          }}
        >
          <Tooltip>
            {inc.description ?? (inc.type === 'blockage' ? 'Road Blockage' : 'Congestion Zone')}
          </Tooltip>
        </Circle>
      ))}

      {patientCoords && (
        <CircleMarker
          center={patientCoords}
          radius={9}
          pathOptions={{ color: '#fff', weight: 2, fillColor: '#3B82F6', fillOpacity: 1 }}
        >
          <Tooltip permanent direction="top" offset={[0, -10]}>
            Patient
          </Tooltip>
        </CircleMarker>
      )}

      {hospital && (
        <CircleMarker
          center={[hospital.lat, hospital.lng]}
          radius={10}
          pathOptions={{ color: '#fff', weight: 2, fillColor: '#22C55E', fillOpacity: 1 }}
        >
          <Tooltip permanent direction="top" offset={[0, -10]}>
            🏥 {hospital.name}
          </Tooltip>
        </CircleMarker>
      )}
    </MapContainer>
  )
}
