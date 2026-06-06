const DEFAULT_CENTER = [7.3775, 3.9470];

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

// Per-ambulance map layers
const ambulanceMarkers  = {};   // id → L.Marker
const pickupRouteLayers = {};   // id → L.Polyline  (Phase 1 pickup route)
const pickupPinMarkers  = {};   // id → L.Marker    (pickup point)
const hospRouteLayers   = {};   // id → L.Polyline  (Phase 2 hospital route)
const hospPinMarkers    = {};   // id → L.Marker    (hospital destination)

// Incident map circles
const incidentCircles   = {};   // inc_id → L.Circle

let pickupPoint = null;

// ── Pickup-point click ────────────────────────────────────────────────────────
let pickupClickMarker  = null;
let placingIncident    = false;

map.on('click', async (e) => {
  if (placingIncident) {
    await placeIncident(e.latlng.lat, e.latlng.lng);
    return;
  }

  // Normal click → set pickup point for dispatch
  pickupPoint = { lat: e.latlng.lat, lng: e.latlng.lng };
  document.getElementById('pickup-coords').textContent =
    `${pickupPoint.lat.toFixed(5)}, ${pickupPoint.lng.toFixed(5)}`;

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
    updateUnitListItem(id, color);
  } else {
    ambulanceMarkers[id].setLatLng([lat, lng]);
  }
}

function updateUnitListItem(id, color, extra = '') {
  const list = document.getElementById('unit-items');
  let li = document.getElementById(`unit-${id}`);
  if (!li) {
    li = document.createElement('li');
    li.id = `unit-${id}`;
    li.style.setProperty('--color', color);
    list.appendChild(li);
  }
  li.innerHTML = `${id}${extra}`;
}

// ── Draw pickup route (Phase 1 broadcast) ─────────────────────────────────────
function drawPickupRoute(msg) {
  const color = colorFor(msg.ambulance_id);

  if (pickupRouteLayers[msg.ambulance_id]) map.removeLayer(pickupRouteLayers[msg.ambulance_id]);
  if (pickupPinMarkers[msg.ambulance_id])  map.removeLayer(pickupPinMarkers[msg.ambulance_id]);

  pickupRouteLayers[msg.ambulance_id] = L.polyline(msg.geometry, {
    color, weight: 4, opacity: 0.75, dashArray: '6 4',
  }).addTo(map);

  pickupPinMarkers[msg.ambulance_id] = L.marker([msg.pickup.lat, msg.pickup.lng], {
    icon: L.divIcon({ className: '', html: '📍', iconSize: [28, 28], iconAnchor: [14, 28] }),
  }).addTo(map).bindPopup(`Pickup for ${msg.ambulance_id}`);
}

// ── Draw hospital route (Phase 2 broadcast) ───────────────────────────────────
function drawHospitalRoute(msg) {
  const color = colorFor(msg.ambulance_id);

  if (hospRouteLayers[msg.ambulance_id]) map.removeLayer(hospRouteLayers[msg.ambulance_id]);
  if (hospPinMarkers[msg.ambulance_id])  map.removeLayer(hospPinMarkers[msg.ambulance_id]);

  hospRouteLayers[msg.ambulance_id] = L.polyline(msg.geometry, {
    color, weight: 5, opacity: 0.9,
  }).addTo(map);

  hospPinMarkers[msg.ambulance_id] = L.marker(
    [msg.destination.lat, msg.destination.lng],
    { icon: L.divIcon({ className: '', html: '🏥', iconSize: [28, 28], iconAnchor: [14, 28] }) },
  ).addTo(map).bindPopup(`${msg.destination.name} (${msg.ambulance_id})`);

  // Update sidebar unit item
  const sec = msg.security_recommendation;
  const secHtml = sec.recommended
    ? ` <span class="sec-warn">⚠ Security</span>`
    : '';
  const effMin = Math.round(msg.effective_duration_s / 60);
  updateUnitListItem(msg.ambulance_id, colorFor(msg.ambulance_id),
    ` → ${msg.destination.name} (${effMin} min)${secHtml}`);
}

// ── Incident rendering ────────────────────────────────────────────────────────
function incidentColor(type) {
  return type === 'congestion' ? '#e67e22' : '#e74c3c';
}

function addIncidentCircle(inc) {
  if (incidentCircles[inc.id]) {
    map.removeLayer(incidentCircles[inc.id]);
  }
  incidentCircles[inc.id] = L.circle([inc.lat, inc.lng], {
    radius: inc.radius_m,
    color: incidentColor(inc.type),
    fillColor: incidentColor(inc.type),
    fillOpacity: 0.25,
    weight: 2,
  }).addTo(map).bindPopup(
    `<b>${inc.type === 'congestion' ? '🚦 Congestion' : '🚧 Blockage'}</b><br>` +
    `${inc.description || ''}<br>+${inc.delay_min} min delay`
  );
}

function removeIncidentCircle(id) {
  if (incidentCircles[id]) {
    map.removeLayer(incidentCircles[id]);
    delete incidentCircles[id];
  }
}

function renderIncidentList(incidents) {
  const ul = document.getElementById('incident-list');
  ul.innerHTML = '';
  incidents.forEach(inc => {
    const li = document.createElement('li');
    li.className = inc.type;
    li.id = `inc-li-${inc.id}`;
    li.innerHTML =
      `<span class="inc-label">${inc.type === 'congestion' ? '🚦' : '🚧'} ${inc.description || inc.type} (+${inc.delay_min}min)</span>` +
      `<button data-id="${inc.id}">✕</button>`;
    li.querySelector('button').addEventListener('click', () => deleteIncident(inc.id));
    ul.appendChild(li);
  });
}

// ── Incident CRUD ─────────────────────────────────────────────────────────────
let allIncidents = [];

async function fetchIncidents() {
  const data = await fetch('/mock/incidents').then(r => r.json());
  allIncidents = data.incidents;
  allIncidents.forEach(i => addIncidentCircle(i));
  renderIncidentList(allIncidents);
}

async function placeIncident(lat, lng) {
  const body = {
    type:        document.getElementById('inc-type').value,
    lat, lng,
    radius_m:    parseFloat(document.getElementById('inc-radius').value),
    delay_min:   parseFloat(document.getElementById('inc-delay').value),
    description: document.getElementById('inc-desc').value || '',
  };
  const inc = await fetch('/mock/incidents', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then(r => r.json());

  allIncidents.push(inc);
  addIncidentCircle(inc);
  renderIncidentList(allIncidents);

  // Exit placing mode
  placingIncident = false;
  document.getElementById('place-inc-btn').classList.remove('active');
  document.getElementById('place-inc-btn').textContent = '📍 Click map to place';
}

async function deleteIncident(id) {
  await fetch(`/mock/incidents/${id}`, { method: 'DELETE' });
  allIncidents = allIncidents.filter(i => i.id !== id);
  removeIncidentCircle(id);
  renderIncidentList(allIncidents);
}

document.getElementById('place-inc-btn').addEventListener('click', () => {
  placingIncident = !placingIncident;
  const btn = document.getElementById('place-inc-btn');
  if (placingIncident) {
    btn.classList.add('active');
    btn.textContent = '✕ Cancel (click map to place)';
  } else {
    btn.classList.remove('active');
    btn.textContent = '📍 Click map to place';
  }
});

document.getElementById('clear-all-inc-btn').addEventListener('click', async () => {
  await fetch('/mock/incidents', { method: 'DELETE' });
  Object.keys(incidentCircles).forEach(id => removeIncidentCircle(id));
  allIncidents = [];
  renderIncidentList([]);
});

// ── WebSocket ─────────────────────────────────────────────────────────────────
const wsBadge = document.getElementById('ws-status');
let ws             = null;
let reconnectTimer = null;

function setWsStatus(s) {
  wsBadge.textContent = s === 'connected' ? 'Live' : s === 'reconnecting' ? 'Reconnecting…' : 'Disconnected';
  wsBadge.className   = `badge ${s}`;
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
      drawPickupRoute(msg);
    } else if (msg.type === 'hospital_route') {
      drawHospitalRoute(msg);
    } else if (msg.type === 'incident_snapshot') {
      // Seeded incidents sent on connect — add any not already shown
      msg.incidents.forEach(inc => {
        if (!allIncidents.find(i => i.id === inc.id)) {
          allIncidents.push(inc);
          addIncidentCircle(inc);
        }
      });
      renderIncidentList(allIncidents);
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
  const btn      = document.getElementById('send-btn');

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
      resultEl.className   = 'success';
      resultEl.textContent =
        `Dispatched ${body.ambulance_id} — ETA ${Math.round(body.duration_s / 60)} min, ${(body.distance_m / 1000).toFixed(1)} km`;
    } else {
      resultEl.className   = 'error';
      resultEl.textContent = body.detail?.reason ?? body.detail ?? 'Dispatch failed';
    }
  } catch (err) {
    resultEl.className   = 'error';
    resultEl.textContent = `Network error: ${err.message}`;
  } finally {
    btn.disabled    = false;
    btn.textContent = 'Send Dispatch';
  }
});

// ── Boot ──────────────────────────────────────────────────────────────────────
loadAmbulances();
connectDispatch();
fetchIncidents();
