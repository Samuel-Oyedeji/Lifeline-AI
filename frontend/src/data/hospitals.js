// Mock hospital intelligence dataset (Lagos).
// In a real deployment this would stream from the backend /predict API
// (AWS Lambda + DynamoDB historical traffic model). Shape is kept
// API-like so swapping the source later is a one-line change.

export const PATIENT_LOCATION = {
  name: 'Yaba, Lagos',
  coords: [6.5095, 3.3711],
}

export const HOSPITALS = [
  {
    id: 'luth',
    name: 'Lagos University Teaching Hospital',
    short: 'LUTH',
    coords: [6.5167, 3.35],
    etaMin: 8,
    predictedDelayMin: 1,
    bedsAvailable: 12,
    icu: true,
    specialists: ['Cardiac', 'Trauma', 'Stroke'],
    score: 95,
    distanceKm: 4.2,
    reasons: [
      'ICU bed available now',
      'Cardiac specialist on duty',
      'Lowest predicted congestion delay',
      '4 minutes faster than next best',
    ],
  },
  {
    id: 'gbagada',
    name: 'Gbagada General Hospital',
    short: 'Gbagada General',
    coords: [6.555, 3.3841],
    etaMin: 12,
    predictedDelayMin: 5,
    bedsAvailable: 6,
    icu: true,
    specialists: ['Trauma', 'Accident'],
    score: 82,
    distanceKm: 6.1,
    reasons: ['ICU available', 'Trauma team ready', 'Moderate predicted delay'],
  },
  {
    id: 'island',
    name: 'Lagos Island General Hospital',
    short: 'Island General',
    coords: [6.4541, 3.3947],
    etaMin: 17,
    predictedDelayMin: 9,
    bedsAvailable: 3,
    icu: false,
    specialists: ['Accident'],
    score: 64,
    distanceKm: 8.4,
    reasons: ['No ICU bed currently', 'High predicted congestion on route'],
  },
]

export const EMERGENCY_TYPES = [
  { id: 'cardiac', label: 'Cardiac', icon: '❤️' },
  { id: 'trauma', label: 'Trauma', icon: '🩸' },
  { id: 'stroke', label: 'Stroke', icon: '🧠' },
  { id: 'accident', label: 'Accident', icon: '🚗' },
]

export const PRIORITIES = [
  { id: 'low', label: 'Low', color: 'var(--success)' },
  { id: 'medium', label: 'Medium', color: 'var(--warning)' },
  { id: 'critical', label: 'Critical', color: 'var(--critical)' },
]

// Route geometry between patient and the recommended hospital (LUTH).
// "current" = naive fastest route (red), "recommended" = AI reroute (green).
export const ROUTES = {
  current: [
    [6.5095, 3.3711],
    [6.5123, 3.3668],
    [6.5108, 3.3589],
    [6.5155, 3.3531],
    [6.5167, 3.35],
  ],
  recommended: [
    [6.5095, 3.3711],
    [6.5161, 3.3712],
    [6.5201, 3.3631],
    [6.5189, 3.3547],
    [6.5167, 3.35],
  ],
}

// Predicted congestion hot-zone (orange) — Ikorodu Road corridor.
export const TRAFFIC_ZONE = {
  center: [6.5112, 3.3625],
  radius: 520,
  label: 'Ikorodu Road · heavy congestion predicted',
}
