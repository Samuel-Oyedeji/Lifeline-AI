// Ambulance fleet metadata — IDs match backend ambulances.json.
// coords are default/last-known positions; live positions come from the dispatch WebSocket.
// status starts as 'available'; the backend may update this in future phases.
export const AMBULANCES = [
  { id: 'LAG-A12', coords: [6.5121, 3.3685], status: 'available', type: 'Advanced Life Support', crew: 'Paramedic + EMT', plate: 'LND-238-AA' },
  { id: 'LAG-B07', coords: [6.5043, 3.3779], status: 'available', type: 'Advanced Life Support', crew: 'Paramedic + EMT', plate: 'KJA-114-XB' },
  { id: 'LAG-C21', coords: [6.5202, 3.3622], status: 'available', type: 'Basic Life Support',    crew: 'EMT x2',          plate: 'EPE-907-LC' },
  { id: 'LAG-D03', coords: [6.4998, 3.3550], status: 'busy',      type: 'Advanced Life Support', crew: 'Paramedic + EMT', plate: 'AGL-552-KD' },
  { id: 'LAG-E15', coords: [6.5310, 3.3789], status: 'available', type: 'Basic Life Support',    crew: 'EMT x2',          plate: 'IKD-330-RE' },
  { id: 'LAG-F09', coords: [6.4885, 3.3702], status: 'busy',      type: 'Advanced Life Support', crew: 'Paramedic + EMT', plate: 'SUR-741-MF' },
  { id: 'IBD-A01', coords: [7.3850, 3.9520], status: 'available', type: 'Advanced Life Support', crew: 'Paramedic + EMT', plate: 'OYO-112-AA' },
  { id: 'IBD-B02', coords: [7.3700, 3.9400], status: 'available', type: 'Basic Life Support',    crew: 'EMT x2',          plate: 'OYO-334-BA' },
  { id: 'IBD-C03', coords: [7.3920, 3.9610], status: 'available', type: 'Advanced Life Support', crew: 'Paramedic + EMT', plate: 'OYO-567-CA' },
  { id: 'IBD-D04', coords: [7.3650, 3.9580], status: 'busy',      type: 'Basic Life Support',    crew: 'EMT x2',          plate: 'OYO-789-DA' },
  { id: 'IBD-E05', coords: [7.3800, 3.9320], status: 'available', type: 'Advanced Life Support', crew: 'Paramedic + EMT', plate: 'OYO-901-EA' },
]

// Haversine distance in km between two [lat, lng] points.
export function kmBetween(a, b) {
  const toRad = (d) => (d * Math.PI) / 180
  const R = 6371
  const dLat = toRad(b[0] - a[0])
  const dLng = toRad(b[1] - a[1])
  const lat1 = toRad(a[0])
  const lat2 = toRad(b[0])
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2)
  return 2 * R * Math.asin(Math.sqrt(h))
}

// Rough urban ETA: ~26 km/h average through Lagos traffic + ~1 min mobilise.
export function etaMinutes(km) {
  return Math.max(1, Math.round((km / 26) * 60) + 1)
}

// Returns the fleet annotated with distance/eta to a point, sorted nearest-first.
export function rankByDistance(point) {
  return AMBULANCES.map((a) => {
    const km = kmBetween(a.coords, point)
    return { ...a, distanceKm: km, etaMin: etaMinutes(km) }
  }).sort((x, y) => x.distanceKm - y.distanceKm)
}

// Nearest unit that is currently available.
export function closestAvailable(point) {
  return rankByDistance(point).find((a) => a.status === 'available') ?? null
}
