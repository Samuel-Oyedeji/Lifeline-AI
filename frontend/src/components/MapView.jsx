import { MapContainer, TileLayer, Polyline, Circle, CircleMarker, Tooltip } from 'react-leaflet'
import { PATIENT_LOCATION, ROUTES, TRAFFIC_ZONE } from '../data/hospitals.js'

// Dark, label-light basemap from CARTO (free, no API key) — gives the
// Uber/Tesla-style night map look.
const DARK_TILES = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
const ATTR = '&copy; OpenStreetMap &copy; CARTO'

export default function MapView({ hospital, showRecommended = true, showCurrent = true }) {
  const center = [
    (PATIENT_LOCATION.coords[0] + hospital.coords[0]) / 2,
    (PATIENT_LOCATION.coords[1] + hospital.coords[1]) / 2,
  ]

  return (
    <MapContainer
      center={center}
      zoom={14}
      zoomControl={true}
      scrollWheelZoom={true}
      attributionControl={true}
    >
      <TileLayer url={DARK_TILES} attribution={ATTR} subdomains="abcd" maxZoom={20} />

      {/* Predicted congestion zone (orange) */}
      <Circle
        center={TRAFFIC_ZONE.center}
        radius={TRAFFIC_ZONE.radius}
        pathOptions={{
          color: '#F59E0B',
          weight: 1,
          fillColor: '#F59E0B',
          fillOpacity: 0.18,
        }}
      >
        <Tooltip>{TRAFFIC_ZONE.label}</Tooltip>
      </Circle>

      {/* Current naive route (red) */}
      {showCurrent && (
        <Polyline
          positions={ROUTES.current}
          pathOptions={{ color: '#EF4444', weight: 5, opacity: 0.85, dashArray: '2 10' }}
        />
      )}

      {/* AI recommended reroute (green) */}
      {showRecommended && (
        <Polyline
          positions={ROUTES.recommended}
          pathOptions={{ color: '#22C55E', weight: 6, opacity: 0.95 }}
        />
      )}

      {/* Patient marker */}
      <CircleMarker
        center={PATIENT_LOCATION.coords}
        radius={9}
        pathOptions={{ color: '#fff', weight: 2, fillColor: '#3B82F6', fillOpacity: 1 }}
      >
        <Tooltip permanent direction="top" offset={[0, -10]}>
          Patient · {PATIENT_LOCATION.name}
        </Tooltip>
      </CircleMarker>

      {/* Hospital marker */}
      <CircleMarker
        center={hospital.coords}
        radius={10}
        pathOptions={{ color: '#fff', weight: 2, fillColor: '#22C55E', fillOpacity: 1 }}
      >
        <Tooltip permanent direction="top" offset={[0, -10]}>
          {hospital.short}
        </Tooltip>
      </CircleMarker>
    </MapContainer>
  )
}
