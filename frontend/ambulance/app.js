const THROTTLE_MS = 2000;
const MIN_MOVE_M  = 5;

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

setTimeout(() => map.invalidateSize(), 0);
window.addEventListener('resize', () => map.invalidateSize());

let selfMarker      = null;
let pickupRouteLayer = null;
let pickupMarker    = null;
let hospitalRouteLayer = null;
let hospitalMarker  = null;

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

// ── Render: pickup route ──────────────────────────────────────────────────────
function drawPickupRoute(msg) {
  if (pickupRouteLayer) map.removeLayer(pickupRouteLayer);
  if (pickupMarker)     map.removeLayer(pickupMarker);

  pickupRouteLayer = L.polyline(msg.geometry, { color: '#e74c3c', weight: 5, opacity: 0.8 }).addTo(map);
  pickupMarker = L.marker([msg.pickup.lat, msg.pickup.lng], {
    icon: L.divIcon({ className: '', html: '📍', iconSize: [28, 28], iconAnchor: [14, 28] }),
  }).addTo(map).bindPopup('Pickup point');

  map.fitBounds(pickupRouteLayer.getBounds(), { padding: [30, 30] });

  const banner = document.getElementById('route-banner');
  banner.classList.remove('hidden');
  document.getElementById('route-eta').textContent  = `ETA: ${Math.round(msg.duration_s / 60)} min`;
  document.getElementById('route-dist').textContent = `Dist: ${(msg.distance_m / 1000).toFixed(1)} km`;

  // Enable the "Patient Picked Up" button now that the unit is dispatched
  document.getElementById('pickup-bar').classList.remove('hidden');
  document.getElementById('pickup-btn').disabled = false;
}

// ── Render: hospital route ────────────────────────────────────────────────────
function drawHospitalRoute(msg) {
  if (hospitalRouteLayer) map.removeLayer(hospitalRouteLayer);
  if (hospitalMarker)     map.removeLayer(hospitalMarker);

  hospitalRouteLayer = L.polyline(msg.geometry, { color: '#2ecc71', weight: 5, opacity: 0.85 }).addTo(map);
  hospitalMarker = L.marker([msg.destination.lat, msg.destination.lng], {
    icon: L.divIcon({ className: '', html: '🏥', iconSize: [28, 28], iconAnchor: [14, 28] }),
  }).addTo(map).bindPopup(msg.destination.name);

  map.fitBounds(hospitalRouteLayer.getBounds(), { padding: [30, 30] });

  // Hospital banner
  const banner = document.getElementById('hospital-banner');
  banner.classList.remove('hidden');
  document.getElementById('hospital-name').textContent = msg.destination.name;

  const effectiveMin = Math.round(msg.effective_duration_s / 60);
  const rawMin       = Math.round(msg.duration_s / 60);
  document.getElementById('hospital-eta').textContent = `ETA: ${effectiveMin} min`;

  const delayEl = document.getElementById('hospital-delay');
  if (msg.effective_duration_s > msg.duration_s) {
    delayEl.textContent = `(+${effectiveMin - rawMin} min incident delay, raw ${rawMin} min)`;
    delayEl.classList.remove('hidden');
  } else {
    delayEl.classList.add('hidden');
  }
  document.getElementById('hospital-dist').textContent =
    `Distance: ${(msg.distance_m / 1000).toFixed(1)} km`;

  // Security recommendation
  const sec = msg.security_recommendation;
  const secBanner = document.getElementById('security-banner');
  if (sec.recommended) {
    secBanner.classList.remove('hidden');
    document.getElementById('security-reason').textContent  = sec.reason;
    const savedMin = Math.round((sec.estimated_time_saved_s || 0) / 60);
    document.getElementById('security-savings').textContent = `~${savedMin} min could be saved`;
  } else {
    secBanner.classList.add('hidden');
  }

  // Alternatives
  const altPanel = document.getElementById('alternatives-panel');
  const altList  = document.getElementById('alt-list');
  altList.innerHTML = '';
  if (msg.alternatives && msg.alternatives.length) {
    altPanel.classList.remove('hidden');
    msg.alternatives.forEach(alt => {
      const li = document.createElement('li');
      const effMin = Math.round(alt.effective_duration_s / 60);
      li.textContent = `${alt.name} — ${effMin} min`;
      altList.appendChild(li);
    });
  } else {
    altPanel.classList.add('hidden');
  }

  // Re-enable pickup button for re-triggering
  document.getElementById('pickup-btn').disabled = false;
  document.getElementById('pickup-btn').textContent = 'Recompute Hospital Route';
}

// ── WebSocket ─────────────────────────────────────────────────────────────────
const statusBadge  = document.getElementById('status-badge');
const wsErrorEl    = document.getElementById('ws-error-msg');
let ws             = null;
let reconnectTimer = null;

function setStatus(s) {
  statusBadge.textContent = s === 'connected' ? 'Connected' : s === 'reconnecting' ? 'Reconnecting…' : 'Disconnected';
  statusBadge.className   = `badge ${s}`;
}

function connect() {
  ws = new WebSocket(`ws://${location.host}/ws/ambulance/${ambulanceId}`);

  ws.onopen = () => { setStatus('connected'); clearTimeout(reconnectTimer); };

  ws.onmessage = (evt) => {
    const msg = JSON.parse(evt.data);
    if      (msg.type === 'route')          drawPickupRoute(msg);
    else if (msg.type === 'hospital_route') drawHospitalRoute(msg);
    else if (msg.type === 'error') {
      wsErrorEl.textContent = `Error: ${msg.message}`;
      wsErrorEl.classList.remove('hidden');
      setTimeout(() => wsErrorEl.classList.add('hidden'), 8000);
      document.getElementById('pickup-btn').disabled = false;
    }
  };

  ws.onclose = ws.onerror = () => {
    setStatus('reconnecting');
    reconnectTimer = setTimeout(connect, 2000);
  };
}

// ── Pickup button ─────────────────────────────────────────────────────────────
document.getElementById('pickup-btn').addEventListener('click', () => {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  document.getElementById('pickup-btn').disabled = true;
  document.getElementById('pickup-btn').textContent = 'Computing…';
  ws.send(JSON.stringify({ type: 'pickup_complete', ts: Math.floor(Date.now() / 1000) }));
});

document.getElementById('request-security-btn').addEventListener('click', () => {
  // Stub — advisory only; logs intent for Phase 3 integration
  console.log('[SECURITY] Security request flagged for ambulance', ambulanceId);
  document.getElementById('request-security-btn').textContent = 'Requested ✓';
  document.getElementById('request-security-btn').disabled = true;
});

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

  const now   = Date.now();
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
    navigator.geolocation.watchPosition(onPosition, onGeoError, {
      enableHighAccuracy: false, maximumAge: 5000, timeout: 15000,
    });
  } else {
    document.getElementById('geo-error').classList.remove('hidden');
  }
})();
