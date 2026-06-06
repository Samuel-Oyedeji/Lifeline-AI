// Operating area default centre — Ibadan, Nigeria
const DEFAULT_CENTER = [7.3775, 3.9470];

// Per-ambulance color palette
const COLORS = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6'];
const colorFor = (() => {
  const cache = {};
  let i = 0;
  return (id) => { if (!cache[id]) cache[id] = COLORS[i++ % COLORS.length]; return cache[id]; };
})();

// ── Map ───────────────────────────────────────────────────────────────────────
const map = L.map('map').setView(DEFAULT_CENTER, 13);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap contributors',
  maxZoom: 19,
}).addTo(map);

setTimeout(() => map.invalidateSize(), 0);
window.addEventListener('resize', () => map.invalidateSize());

// State
const ambulanceMarkers = {};   // id → L.Marker
const routeLayers      = {};   // id → L.Polyline
const pickupMarkers    = {};   // id → L.Marker
let pickupPoint        = null; // {lat, lng} set by click

// ── Pickup click ──────────────────────────────────────────────────────────────
let pickupClickMarker = null;

map.on('click', (e) => {
  pickupPoint = { lat: e.latlng.lat, lng: e.latlng.lng };
  document.getElementById('pickup-coords').textContent =
    `${pickupPoint.lat.toFixed(5)}, ${pickupPoint.lng.toFixed(5)}`;
  document.getElementById('pickup-lat').value = pickupPoint.lat;
  document.getElementById('pickup-lng').value = pickupPoint.lng;

  if (pickupClickMarker) map.removeLayer(pickupClickMarker);
  pickupClickMarker = L.marker([pickupPoint.lat, pickupPoint.lng], {
    icon: L.divIcon({ className: '', html: '📌', iconSize: [28, 28], iconAnchor: [14, 28] }),
  }).addTo(map).bindPopup('Pickup').openPopup();
});

// ── Ambulance markers ─────────────────────────────────────────────────────────
function upsertAmbulance(id, lat, lng) {
  const color = colorFor(id);
  if (!ambulanceMarkers[id]) {
    ambulanceMarkers[id] = L.marker([lat, lng], {
      icon: L.divIcon({
        className: '',
        html: `<div style="background:${color};color:#fff;padding:2px 6px;border-radius:4px;font-size:11px;font-weight:700;white-space:nowrap;">🚑 ${id}</div>`,
        iconAnchor: [28, 12],
      }),
    }).addTo(map).bindPopup(id);

    updateUnitList(id, color);
  } else {
    ambulanceMarkers[id].setLatLng([lat, lng]);
  }
}

function updateUnitList(id, color) {
  const list = document.getElementById('unit-items');
  let li = document.getElementById(`unit-${id}`);
  if (!li) {
    li = document.createElement('li');
    li.id = `unit-${id}`;
    li.style.setProperty('--color', color);
    list.appendChild(li);
  }
  li.textContent = id;
}

function drawRoute(msg) {
  const color = colorFor(msg.ambulance_id);

  if (routeLayers[msg.ambulance_id])  map.removeLayer(routeLayers[msg.ambulance_id]);
  if (pickupMarkers[msg.ambulance_id]) map.removeLayer(pickupMarkers[msg.ambulance_id]);

  routeLayers[msg.ambulance_id] = L.polyline(msg.geometry, {
    color, weight: 5, opacity: 0.85,
  }).addTo(map);

  pickupMarkers[msg.ambulance_id] = L.marker([msg.pickup.lat, msg.pickup.lng], {
    icon: L.divIcon({ className: '', html: '📍', iconSize: [28, 28], iconAnchor: [14, 28] }),
  }).addTo(map).bindPopup(`Pickup for ${msg.ambulance_id}`);
}

// ── WebSocket ─────────────────────────────────────────────────────────────────
const wsBadge = document.getElementById('ws-status');
let ws = null;
let reconnectTimer = null;

function setWsStatus(s) {
  wsBadge.textContent = s === 'connected' ? 'Live' : s === 'reconnecting' ? 'Reconnecting…' : 'Disconnected';
  wsBadge.className = `badge ${s}`;
}

function connectDispatch() {
  ws = new WebSocket(`ws://${location.host}/ws/dispatch`);

  ws.onopen = () => { setWsStatus('connected'); clearTimeout(reconnectTimer); };

  ws.onmessage = (evt) => {
    const msg = JSON.parse(evt.data);
    if (msg.type === 'snapshot') {
      msg.ambulances.forEach(a => upsertAmbulance(a.ambulance_id, a.lat, a.lng));
    } else if (msg.type === 'position') {
      upsertAmbulance(msg.ambulance_id, msg.lat, msg.lng);
    } else if (msg.type === 'route') {
      drawRoute(msg);
    }
  };

  ws.onclose = ws.onerror = () => {
    setWsStatus('reconnecting');
    reconnectTimer = setTimeout(connectDispatch, 2000);
  };
}

// ── Ambulance dropdown ────────────────────────────────────────────────────────
async function loadAmbulances() {
  const data = await fetch('/ambulances').then(r => r.json());
  const sel = document.getElementById('amb-select');
  sel.innerHTML = '<option value="">— select —</option>';
  data.ambulances.forEach(a => {
    const opt = document.createElement('option');
    opt.value = a.id;
    opt.textContent = `${a.id} — ${a.label}`;
    sel.appendChild(opt);
  });
}

// ── Dispatch form ─────────────────────────────────────────────────────────────
document.getElementById('dispatch-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const resultEl = document.getElementById('dispatch-result');
  const btn = document.getElementById('send-btn');

  const ambulanceId = document.getElementById('amb-select').value;
  if (!ambulanceId) return alert('Select an ambulance first.');
  if (!pickupPoint)  return alert('Click the map to set a pickup point.');

  btn.disabled = true;
  btn.textContent = 'Sending…';
  resultEl.className = 'hidden';

  try {
    const res = await fetch('/dispatch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ambulance_id: ambulanceId,
        pickup: pickupPoint,
        patient: {
          name:  document.getElementById('patient-name').value || null,
          notes: document.getElementById('patient-notes').value || null,
        },
      }),
    });

    const body = await res.json();

    if (res.ok) {
      resultEl.className = 'success';
      resultEl.textContent =
        `Dispatched ${body.ambulance_id} — ETA ${Math.round(body.duration_s / 60)} min, ${(body.distance_m / 1000).toFixed(1)} km`;
    } else {
      resultEl.className = 'error';
      resultEl.textContent = body.detail?.reason ?? body.detail ?? 'Dispatch failed';
    }
  } catch (err) {
    resultEl.className = 'error';
    resultEl.textContent = `Network error: ${err.message}`;
  } finally {
    btn.disabled = false;
    btn.textContent = 'Send Dispatch';
  }
});

// ── Boot ──────────────────────────────────────────────────────────────────────
loadAmbulances();
connectDispatch();
