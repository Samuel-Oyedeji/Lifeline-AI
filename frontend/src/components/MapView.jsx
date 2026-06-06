import { useEffect } from 'react'
import { MapContainer, TileLayer, Polyline, Circle, CircleMarker, Marker, Tooltip, useMap } from 'react-leaflet'
import L from 'leaflet'

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

/** Custom ambulance DivIcon — rendered as inline SVG so no image file needed */
function makeAmbulanceIcon() {
  return L.divIcon({
    className: '',
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    tooltipAnchor: [0, -22],
    html: `
      <div style="
        width:40px;height:40px;border-radius:50%;
        background:linear-gradient(135deg,#06b6d4,#0e7490);
        border:2.5px solid #fff;
        box-shadow:0 2px 12px rgba(6,182,212,0.55);
        display:flex;align-items:center;justify-content:center;
        animation:ambPulse 2s ease-in-out infinite;
      ">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
          stroke="#fff" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
          <path d="M2 7h11v9H2z"/>
          <path d="M13 10h4l3 3v3h-7z"/>
          <circle cx="6.5" cy="18" r="1.8"/>
          <circle cx="16.5" cy="18" r="1.8"/>
          <path d="M6 3.5v3M4.5 5h3"/>
        </svg>
      </div>
      <style>
        @keyframes ambPulse {
          0%,100%{box-shadow:0 2px 12px rgba(6,182,212,0.55)}
          50%{box-shadow:0 2px 22px rgba(6,182,212,0.9),0 0 0 6px rgba(6,182,212,0.15)}
        }
      </style>
    `,
  })
}

const CATEGORY_COLOR = {
  'Teaching Hospital':      '#22C55E',
  'Federal Medical Center': '#22C55E',
  'General Hospital':       '#4ade80',
  'Specialist Hospital':    '#06B6D4',
  'Medical Center':         '#38bdf8',
}

export default function MapView({
  geometry,          // primary route geometry (array of [lat,lng])
  routeColor = '#22C55E',
  secondaryGeometry, // optional secondary route (e.g. hospital route while showing pickup)
  secondaryColor = '#22C55E',
  tertiaryGeometry,  // optional tertiary route (amber route from ambulance direct to hospital)
  tertiaryColor = '#F59E0B',
  patientCoords,
  hospital,          // selected/destination hospital { name, lat, lng }
  hospitals = [],    // nearby hospital list [{ id, name, lat, lng, category, km }]
  ambulanceCoords,   // [lat, lng] of ambulance (dispatcher's live position)
  ambulanceLabel = 'Ambulance',
  incidents = [],
}) {
  const center = patientCoords ?? ambulanceCoords ?? [6.5095, 3.3711]

  // Determine which geometry to use for FitRoute
  // If we have both, fit both by combining them
  const fitPositions = (() => {
    let pts = []
    if (geometry?.length > 1) pts.push(...geometry)
    if (secondaryGeometry?.length > 1) pts.push(...secondaryGeometry)
    if (tertiaryGeometry?.length > 1) pts.push(...tertiaryGeometry)
    return pts.length > 1 ? pts : undefined
  })()

  return (
    <MapContainer center={center} zoom={14} zoomControl={true} scrollWheelZoom={true} attributionControl={true}>
      <TileLayer url={DARK_TILES} attribution={ATTR} subdomains="abcd" maxZoom={20} />

      {fitPositions?.length > 1 && <FitRoute positions={fitPositions} />}

      {/* Primary route */}
      {geometry?.length > 1 && (
        <Polyline
          positions={geometry}
          pathOptions={{ color: routeColor, weight: 6, opacity: 0.95, dashArray: routeColor === '#EF4444' ? '8 10' : undefined }}
        />
      )}

      {/* Secondary route (e.g. pickup to hospital) */}
      {secondaryGeometry?.length > 1 && (
        <Polyline
          positions={secondaryGeometry}
          pathOptions={{ color: secondaryColor, weight: 6, opacity: 0.95, dashArray: '6 8' }}
        />
      )}

      {/* Tertiary route (e.g. ambulance to hospital) */}
      {tertiaryGeometry?.length > 1 && (
        <Polyline
          positions={tertiaryGeometry}
          pathOptions={{ color: tertiaryColor, weight: 6, opacity: 0.95, dashArray: '4 8' }}
        />
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

      {/* Ambulance icon marker */}
      {ambulanceCoords && (
        <Marker position={ambulanceCoords} icon={makeAmbulanceIcon()}>
          <Tooltip direction="top" offset={[0, -22]}>
            🚑 {ambulanceLabel}
          </Tooltip>
        </Marker>
      )}

      {/* Patient pickup point */}
      {patientCoords && (
        <CircleMarker
          center={patientCoords}
          radius={9}
          pathOptions={{ color: '#fff', weight: 2, fillColor: '#3B82F6', fillOpacity: 1 }}
        >
          <Tooltip permanent direction="top" offset={[0, -10]}>
            📍 Patient
          </Tooltip>
        </CircleMarker>
      )}

      {/* Nearby hospitals list */}
      {hospitals.map((h) => {
        const isSelected = hospital?.name === h.name
        const baseColor = CATEGORY_COLOR[h.category] ?? '#22C55E'
        return (
          <CircleMarker
            key={h.id}
            center={[h.lat, h.lng]}
            radius={isSelected ? 12 : 7}
            pathOptions={{
              color: '#fff',
              weight: isSelected ? 2.5 : 1,
              fillColor: isSelected ? '#22C55E' : baseColor,
              fillOpacity: isSelected ? 1 : 0.55,
            }}
          >
            <Tooltip permanent={isSelected} direction="top" offset={[0, isSelected ? -12 : -7]}>
              🏥 {h.name}{h.km != null ? ` · ${h.km.toFixed(1)} km` : ''}
            </Tooltip>
          </CircleMarker>
        )
      })}

      {/* Hospital destination (when no hospitals list, or to ensure selected shows on top) */}
      {hospital && hospitals.length === 0 && (
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
