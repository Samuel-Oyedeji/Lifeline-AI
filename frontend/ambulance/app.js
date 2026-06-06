// LifeLine AI — Ambulance Device
// Connects GPS + WebSocket to the dispatch backend.

const DARK_TILES = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
const ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>'

// ── Ambulance ID ─────────────────────────────────────────────────────────────
const urlId = new URLSearchParams(location.search).get('id')
let AMBULANCE_ID = urlId || null

if (!urlId) {
  fetch('config.json')
    .then(r => r.json())
    .then(cfg => { AMBULANCE_ID = cfg.ambulance_id; init() })
    .catch(() => { AMBULANCE_ID = 'LAG-A12'; init() })
} else {
  init()
}

// ── State ─────────────────────────────────────────────────────────────────────
let map, selfMarker, routeLayer, hospitalRouteLayer, pickupMarker, hospitalMarker
let ws, wsTimer
let lastLat = null, lastLng = null

// ── DOM helpers ───────────────────────────────────────────────────────────────
function $(id) { return document.getElementById(id) }

function setConn(state) {
  const colors = { connecting: '#64748b', connected: '#22c55e', reconnecting: '#f59e0b', error: '#ef4444' }
  const labels = { connecting: 'Connecting…', connected: 'Connected', reconnecting: 'Reconnecting…', error: 'Error' }
  $('conn-dot').style.background = colors[state] || '#64748b'
  $('conn-text').textContent = labels[state] || state
}

function setGps(text, color = '#94a3b8') {
  $('gps-dot').style.background = color
  $('gps-text').textContent = text
}

function toast(msg, type = 'info', ms = 4000) {
  const el = document.createElement('div')
  el.className = 'toast ' + type
  el.textContent = msg
  $('toasts').appendChild(el)
  setTimeout(() => el.remove(), ms)
}

// ── Map ───────────────────────────────────────────────────────────────────────
function initMap() {
  map = L.map('map', { zoomControl: true }).setView([6.5095, 3.3711], 14)
  L.tileLayer(DARK_TILES, { attribution: ATTR, subdomains: 'abcd', maxZoom: 20 }).addTo(map)
  setTimeout(() => map.invalidateSize(), 0)
  window.addEventListener('resize', () => map.invalidateSize())
}

// ── GPS ───────────────────────────────────────────────────────────────────────
function startGps() {
  if (!navigator.geolocation) {
    setGps('GPS: not supported', '#ef4444')
    return
  }

  const opts = { enableHighAccuracy: false, maximumAge: 5000, timeout: 15000 }

  navigator.geolocation.watchPosition(
    (pos) => {
      lastLat = pos.coords.latitude
      lastLng = pos.coords.longitude
      setGps(`GPS: ${lastLat.toFixed(4)}, ${lastLng.toFixed(4)}`, '#22c55e')
      updateSelfMarker(lastLat, lastLng)
      sendGps(lastLat, lastLng, pos.coords.heading)
    },
    (err) => {
      if (err.code === 1) { // PERMISSION_DENIED only
        $('gps-error').classList.add('visible')
        setGps('GPS: denied', '#ef4444')
      }
      // TIMEOUT / POSITION_UNAVAILABLE are transient — don't show banner
    },
    opts
  )
}

function updateSelfMarker(lat, lng) {
  if (!selfMarker) {
    selfMarker = L.circleMarker([lat, lng], {
      radius: 10,
      color: '#fff',
      weight: 2.5,
      fillColor: '#06b6d4',
      fillOpacity: 1,
    }).addTo(map)
    selfMarker.bindTooltip('🚑 ' + AMBULANCE_ID, { permanent: false, direction: 'top', offset: [0, -10] })
    map.setView([lat, lng], 15)
  } else {
    selfMarker.setLatLng([lat, lng])
  }
}

function sendGps(lat, lng, heading) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return
  ws.send(JSON.stringify({ type: 'gps', lat, lng, heading: heading ?? null, ts: Date.now() }))
}

// ── WebSocket ─────────────────────────────────────────────────────────────────
function connectWs() {
  if (!AMBULANCE_ID) return
  setConn('connecting')
  ws = new WebSocket(`ws://${location.host}/ws/ambulance/${AMBULANCE_ID}`)

  ws.onopen = () => {
    setConn('connected')
    clearTimeout(wsTimer)
    // Send current position immediately on reconnect
    if (lastLat !== null) sendGps(lastLat, lastLng, null)
  }

  ws.onmessage = (evt) => {
    let msg
    try { msg = JSON.parse(evt.data) } catch { return }

    if (msg.type === 'route') {
      drawPickupRoute(msg)
    } else if (msg.type === 'hospital_route') {
      drawHospitalRoute(msg)
    } else if (msg.type === 'error') {
      toast(msg.message ?? 'Backend error', 'error')
    }
  }

  ws.onclose = ws.onerror = () => {
    setConn('reconnecting')
    wsTimer = setTimeout(connectWs, 2500)
  }
}

// ── Route drawing ─────────────────────────────────────────────────────────────
function drawPickupRoute(msg) {
  // Remove previous route
  if (routeLayer) { map.removeLayer(routeLayer); routeLayer = null }
  if (pickupMarker) { map.removeLayer(pickupMarker); pickupMarker = null }

  const coords = msg.geometry // [[lat,lng], ...]
  if (!coords?.length) return

  routeLayer = L.polyline(coords, {
    color: '#EF4444', weight: 5, opacity: 0.9, dashArray: '6 10'
  }).addTo(map)

  map.fitBounds(routeLayer.getBounds(), { padding: [40, 40] })

  // Pickup point marker
  const p = msg.pickup
  if (p) {
    pickupMarker = L.circleMarker([p.lat, p.lng], {
      radius: 9,
      color: '#fff',
      weight: 2,
      fillColor: '#3B82F6',
      fillOpacity: 1,
    }).addTo(map)
    pickupMarker.bindTooltip('📍 Patient', { permanent: true, direction: 'top', offset: [0, -10] })
  }

  const etaMin = Math.round(msg.duration_s / 60)
  const distKm  = (msg.distance_m / 1000).toFixed(1)

  $('pickup-eta-text').textContent = `En route to patient · ${etaMin} min`
  $('pickup-dist').textContent = `${distKm} km`
  $('pickup-eta').textContent  = `${etaMin} min`
  $('pickup-card').style.display = 'block'
  $('hospital-card').style.display = 'none'

  toast('Route received — navigate to patient pickup', 'success')
}

function drawHospitalRoute(msg) {
  // Remove pickup route
  if (routeLayer) { map.removeLayer(routeLayer); routeLayer = null }
  if (hospitalRouteLayer) { map.removeLayer(hospitalRouteLayer); hospitalRouteLayer = null }
  if (hospitalMarker) { map.removeLayer(hospitalMarker); hospitalMarker = null }
  // Keep self marker and pickup marker for reference

  const coords = msg.geometry
  if (!coords?.length) return

  hospitalRouteLayer = L.polyline(coords, {
    color: '#22C55E', weight: 6, opacity: 0.95
  }).addTo(map)

  map.fitBounds(hospitalRouteLayer.getBounds(), { padding: [40, 40] })

  // Hospital marker
  const dest = msg.destination
  if (dest) {
    hospitalMarker = L.circleMarker([dest.lat, dest.lng], {
      radius: 11,
      color: '#fff',
      weight: 2.5,
      fillColor: '#22C55E',
      fillOpacity: 1,
    }).addTo(map)
    hospitalMarker.bindTooltip('🏥 ' + dest.name, { permanent: true, direction: 'top', offset: [0, -12] })
  }

  const etaMin  = Math.round(msg.effective_duration_s / 60)
  const distKm  = (msg.distance_m / 1000).toFixed(1)

  $('hosp-name').textContent = dest?.name ?? 'Hospital'
  $('hosp-dist').textContent = `${distKm} km`
  $('hosp-eta').textContent  = `${etaMin} min`
  $('pickup-card').style.display = 'none'
  $('hospital-card').style.display = 'block'

  // Security recommendation
  const sec = msg.security_recommendation
  if (sec?.recommended) {
    const saved = Math.round(sec.estimated_time_saved_s / 60)
    $('sec-savings').textContent = ` — ~${saved} min could be saved with escort`
    $('sec-banner').classList.add('visible')
  } else {
    $('sec-banner').classList.remove('visible')
  }

  // Alternatives
  const alts = msg.alternatives ?? []
  if (alts.length > 0) {
    $('alts').innerHTML = alts.map(a =>
      `<div class="alt-chip">${a.name} · ${Math.round(a.effective_duration_s / 60)} min</div>`
    ).join('')
    $('alts').classList.add('visible')
    $('alts-wrap').style.display = 'block'
  }

  toast('Hospital route received — navigate to ' + (dest?.name ?? 'hospital'), 'success')
}

// ── Pickup complete ───────────────────────────────────────────────────────────
function sendPickupComplete() {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    toast('Not connected — cannot confirm pickup', 'error')
    return
  }
  const btn = $('pickup-btn')
  btn.disabled = true
  btn.textContent = 'Sending…'
  ws.send(JSON.stringify({ type: 'pickup_complete' }))
  toast('Pickup confirmed — computing hospital route…', 'success')
}

// ── Init ──────────────────────────────────────────────────────────────────────
function init() {
  $('amb-id').textContent = AMBULANCE_ID ?? '—'
  initMap()
  startGps()
  connectWs()
}
