const THROTTLE_MS = 2000;
const MIN_MOVE_M = 5;

// ── Identity ──────────────────────────────────────────────────────────────────
const params = new URLSearchParams(location.search);
let ambulanceId = params.get('id');

async function loadIdentity() {
  if (!ambulanceId) {
    const cfg = await fetch('./config.json').then(r => r.json());
    ambulanceId = cfg.ambulance_id;
  }
  document.getElementById('unit-label').textContent = `Unit: ${ambulanceId}`;
}

// ── Map ───────────────────────────────────────────────────────────────────────
const map = L.map('map').setView([7.38, 3.90], 14);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap contributors',
  maxZoom: 19,
}).addTo(map);

// Flex layout resolves after script execution — force Leaflet to recalculate size
setTimeout(() => map.invalidateSize(), 0);
window.addEventListener('resize', () => map.invalidateSize());

let selfMarker = null;
let routeLayer = null;
let pickupMarker = null;

function moveSelf(lat, lng) {
  if (!selfMarker) {
    selfMarker = L.marker([lat, lng], {
      icon: L.divIcon({ className: '', html: '🚑', iconSize: [28, 28], iconAnchor: [14, 14] }),
    }).addTo(map).bindPopup(ambulanceId);
    map.setView([lat, lng], 15);
  } else {
    selfMarker.setLatLng([lat, lng]);
  }
}

function drawRoute(msg) {
  if (routeLayer) map.removeLayer(routeLayer);
  if (pickupMarker) map.removeLayer(pickupMarker);

  routeLayer = L.polyline(msg.geometry, { color: '#e74c3c', weight: 5, opacity: 0.8 }).addTo(map);
  pickupMarker = L.marker([msg.pickup.lat, msg.pickup.lng], {
    icon: L.divIcon({ className: '', html: '📍', iconSize: [28, 28], iconAnchor: [14, 28] }),
  }).addTo(map).bindPopup('Pickup point');

  map.fitBounds(routeLayer.getBounds(), { padding: [30, 30] });

  const banner = document.getElementById('route-banner');
  banner.classList.remove('hidden');
  document.getElementById('route-eta').textContent  = `ETA: ${Math.round(msg.duration_s / 60)} min`;
  document.getElementById('route-dist').textContent = `Dist: ${(msg.distance_m / 1000).toFixed(1)} km`;
}

// ── WebSocket ─────────────────────────────────────────────────────────────────
const statusBadge = document.getElementById('status-badge');
let ws = null;
let reconnectTimer = null;

function setStatus(s) {
  statusBadge.textContent = s === 'connected' ? 'Connected' : s === 'reconnecting' ? 'Reconnecting…' : 'Disconnected';
  statusBadge.className = `badge ${s}`;
}

function connect() {
  const host = location.host;
  ws = new WebSocket(`ws://${host}/ws/ambulance/${ambulanceId}`);

  ws.onopen = () => { setStatus('connected'); clearTimeout(reconnectTimer); };

  ws.onmessage = (evt) => {
    const msg = JSON.parse(evt.data);
    if (msg.type === 'route') drawRoute(msg);
  };

  ws.onclose = ws.onerror = () => {
    setStatus('reconnecting');
    reconnectTimer = setTimeout(connect, 2000);
  };
}

// ── GPS ───────────────────────────────────────────────────────────────────────
let lastSendTime = 0;
let lastLat = null, lastLng = null;

function haversineM(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function onPosition(pos) {
  const { latitude: lat, longitude: lng, heading } = pos.coords;
  moveSelf(lat, lng);

  const now = Date.now();
  const moved = lastLat === null ? Infinity : haversineM(lastLat, lastLng, lat, lng);

  if (now - lastSendTime >= THROTTLE_MS && moved >= MIN_MOVE_M) {
    lastSendTime = now;
    lastLat = lat; lastLng = lng;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'gps', lat, lng, heading: heading ?? null, ts: Math.floor(now / 1000) }));
    }
  }
}

function onGeoError(err) {
  // Code 1 = PERMISSION_DENIED — permanent, show the banner.
  // Codes 2/3 (POSITION_UNAVAILABLE / TIMEOUT) are transient; watchPosition keeps retrying.
  if (err.code === 1) {
    document.getElementById('geo-error').classList.remove('hidden');
  }
  console.warn('Geolocation error:', err.code, err.message);
}

// ── Boot ──────────────────────────────────────────────────────────────────────
(async () => {
  await loadIdentity();
  connect();

  if ('geolocation' in navigator) {
    // enableHighAccuracy: false — avoids TIMEOUT errors on desktops without a GPS chip.
    // The browser falls back to network/IP geolocation which resolves quickly.
    navigator.geolocation.watchPosition(onPosition, onGeoError, {
      enableHighAccuracy: false, maximumAge: 5000, timeout: 15000,
    });
  } else {
    document.getElementById('geo-error').classList.remove('hidden');
  }
})();
