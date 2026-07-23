const map = L.map('map', { zoomControl: false }).setView([46.996, 11.98], 11);
L.control.zoom({ position: 'bottomright' }).addTo(map);

const base = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '© OpenStreetMap'
}).addTo(map);
const topo = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
  maxZoom: 17,
  attribution: '© OpenTopoMap'
});
const imagery = L.tileLayer(
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  { maxZoom: 19, attribution: 'Tiles © Esri' }
);
L.control.layers({ Straße: base, Topografie: topo, Satellit: imagery }, null, {
  position: 'bottomleft'
}).addTo(map);

const drawnItems = new L.FeatureGroup().addTo(map);
new L.Control.Draw({
  position: 'topright',
  draw: false,
  edit: {
    featureGroup: drawnItems,
    edit: true,
    remove: true
  }
}).addTo(map);

let selected = null;
let marker = null;
let userLocation = null;
let userLocationLayer = null;
let routeLayer = null;
let activeDrawer = null;
let activeSuggestionPlace = '';
let lastAnalysis = null;

const $ = id => document.getElementById(id);
const status = $('status');
const results = $('results');
const routeResult = $('routeResult');
const LEARNING_KEY = 'alpenLearningProfile';
const PROPERTY_KEY = 'alpenProperties';
const REGION_KEY = 'alpenRegions';
const SCOUT_MODE_KEY = 'alpenScoutMode';

const AUTO_REGION_SUGGESTIONS = [
  {
    id: 'auto-passeier',
    name: 'Passeier Sonnenlagen',
    lat: 46.831,
    lng: 11.206,
    zoom: 12,
    badge: 'Panorama',
    reason: 'Sued- und Westhaenge, Meran-nahe Erreichbarkeit, viele Hofstellen und starke Bergkulisse.',
    tags: ['Bergpanorama', 'Hofstellen', 'Meran-nahe']
  },
  {
    id: 'auto-ultental',
    name: 'Ultental Rueckzugsorte',
    lat: 46.55,
    lng: 11.01,
    zoom: 12,
    badge: 'Refugium',
    reason: 'Sehr ruhige Seitental-Lagen mit Naturkulisse, Wassernaehe und weniger Luxusvilla-Signal.',
    tags: ['Natur', 'Wasser', 'ruhig']
  },
  {
    id: 'auto-villnoess',
    name: 'Villnoess Dolomitenblick',
    lat: 46.64,
    lng: 11.72,
    zoom: 12,
    badge: 'Kulisse',
    reason: 'Dolomitenpanorama und verstreute Lagen, gut fuer Haus- und Grundstuecksspuren.',
    tags: ['Dolomiten', 'Panorama', 'Grundstuecke']
  },
  {
    id: 'auto-ritten',
    name: 'Ritten Hochlagen',
    lat: 46.54,
    lng: 11.46,
    zoom: 12,
    badge: 'Balance',
    reason: 'Hochplateau mit weitem Blick, erreichbarer Infrastruktur und pruefenswerten Altbestand-Spuren.',
    tags: ['Weitblick', 'Altbestand', 'Zufahrt']
  },
  {
    id: 'auto-vinschgau',
    name: 'Vinschgau Sonnenhaenge',
    lat: 46.63,
    lng: 10.78,
    zoom: 11,
    badge: 'Sonne',
    reason: 'Sonnenreiche Hanglagen mit alpinem Charakter, passend fuer einfache Refugien statt Prestigeobjekte.',
    tags: ['Sonne', 'Hanglage', 'rustikal']
  }
];

const areaStyle = {
  color: '#171712',
  fillColor: '#6d8f4e',
  fillOpacity: 0.22,
  weight: 2
};

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[char]);
}

function readJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
  } catch (error) {
    console.warn(`Invalid storage for ${key}`, error);
    return fallback;
  }
}

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function storedFavorites() {
  return readJson('alpenFavorites', []);
}

function storedProperties() {
  return readJson(PROPERTY_KEY, []);
}

function storedRegions() {
  return readJson(REGION_KEY, []);
}

function updateScoutDashboard() {
  const stats = $('scoutStats');
  const next = $('scoutNext');
  if (!stats || !next) return;

  const properties = storedProperties();
  const learning = loadLearningProfile();
  const interesting = properties.filter(property => property.stage === 'interesting').length;
  const regions = storedRegions().length;

  stats.innerHTML = `
    <span>${properties.length} Kandidaten</span>
    <span>${interesting} interessant</span>
    <span>${regions} Regionen</span>
    <span>${learning.entries.length} Lernsignale</span>
  `;

  if (regions && !selected) {
    next.textContent = 'Gespeicherte Region antippen oder neue Vorschlagsregion prüfen.';
  } else if (!selected) {
    next.textContent = 'Automatischen Vorschlag wählen oder Region einzeichnen.';
  } else if (!lastAnalysis) {
    next.textContent = 'Suchlauf starten, dann Objekt speichern.';
  } else if (!properties.length) {
    next.textContent = 'Passendes Angebot aufnehmen oder Off-Market-Spur prüfen.';
  } else if (interesting) {
    next.textContent = 'Interessante Objekte: Kataster, Baurecht, Wert und Kontakt vorbereiten.';
  } else {
    next.textContent = 'Kandidaten bewerten: interessant, prüfen oder verwerfen.';
  }
}

function exportDossier() {
  const payload = {
    exportedAt: new Date().toISOString(),
    app: 'AlpenFinder',
    version: '20260723-segments',
    selected: currentTargetSnapshot(),
    lastAnalysis,
    favorites: storedFavorites(),
    regions: storedRegions(),
    learningProfile: loadLearningProfile(),
    properties: storedProperties(),
    note: 'Personenbezogene Eigentümerdaten gehören erst nach legaler Prüfung und Freigabe in ein geschütztes Backend, nicht in diese lokale PWA.'
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `alpenfinder-dossier-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  status.textContent = 'Dossier exportiert.';
}

function fetchWithTimeout(url, options = {}, timeoutMs = 12000) {
  const controller = new AbortController();
  let timeout;
  const timeoutPromise = new Promise((resolve, reject) => {
    timeout = setTimeout(() => {
      controller.abort();
      reject(new Error('Zeitlimit erreicht'));
    }, timeoutMs);
  });
  return Promise.race([
    fetch(url, { ...options, signal: controller.signal }),
    timeoutPromise
  ]).finally(() => clearTimeout(timeout));
}

function resetOutput() {
  results.innerHTML = '';
  routeResult.innerHTML = '';
  $('score').classList.add('hidden');
  updateScoutDashboard();
}

function enableTargetActions(enabled) {
  ['analyzeBtn', 'routeBtn', 'saveBtn', 'magicBtn'].forEach(id => {
    $(id).disabled = !enabled;
  });
}

function setSelectedPoint(lat, lng, label = 'Ausgewählter Standort') {
  selected = { type: 'point', lat, lng, label };
  document.body.classList.remove('panelHidden');

  if (marker) marker.remove();
  marker = L.marker([lat, lng], { draggable: true })
    .addTo(map)
    .bindPopup(escapeHtml(label))
    .openPopup();
  marker.on('dragend', event => {
    const point = event.target.getLatLng();
    setSelectedPoint(point.lat, point.lng, 'Verschobener Standort');
  });

  $('coords').textContent = `${label} · ${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  enableTargetActions(true);
  resetOutput();
  updateScoutDashboard();
  setTimeout(() => map.invalidateSize(), 0);
}

function getAreaLayers() {
  return drawnItems.getLayers();
}

function setSelectedAreas({ fit = false } = {}) {
  const layers = getAreaLayers();
  $('clearAreasBtn').disabled = layers.length === 0;

  if (!layers.length) {
    if (!selected || selected.type === 'areas') {
      selected = null;
      $('coords').textContent = 'Noch kein Standort ausgewählt.';
      enableTargetActions(false);
      resetOutput();
    }
    return;
  }

  if (marker) {
    marker.remove();
    marker = null;
  }

  const bounds = L.featureGroup(layers).getBounds();
  const center = bounds.getCenter();
  const hectares = layers.reduce((sum, layer) => sum + areaInSquareMeters(layer), 0) / 10000;
  selected = {
    type: 'areas',
    lat: center.lat,
    lng: center.lng,
    label: layers.length === 1 ? 'Eingezeichnetes Suchgebiet' : `${layers.length} eingezeichnete Suchgebiete`
  };

  $('coords').textContent = `${selected.label} · ca. ${hectares.toFixed(1)} ha · Mittelpunkt ${center.lat.toFixed(5)}, ${center.lng.toFixed(5)}`;
  enableTargetActions(true);
  resetOutput();
  updateScoutDashboard();
  if (fit && bounds.isValid()) map.fitBounds(bounds, { padding: [30, 30] });
  setTimeout(() => map.invalidateSize(), 0);
}

function styleAreaLayer(layer) {
  if (layer.setStyle) layer.setStyle(areaStyle);
  layer.on('click', event => {
    L.DomEvent.stopPropagation(event);
    setSelectedAreas();
  });
}

function startDrawing(kind) {
  if (activeDrawer) activeDrawer.disable();
  map.closePopup();
  const options = {
    shapeOptions: areaStyle,
    allowIntersection: false,
    showArea: true,
    metric: true
  };

  if (kind === 'polygon') activeDrawer = new L.Draw.Polygon(map, options);
  if (kind === 'rectangle') activeDrawer = new L.Draw.Rectangle(map, { shapeOptions: areaStyle, metric: true });
  if (kind === 'circle') activeDrawer = new L.Draw.Circle(map, { shapeOptions: areaStyle, metric: true });
  activeDrawer.enable();
  status.textContent = 'Suchgebiet auf der Karte einzeichnen.';
}

map.on('click', event => {
  if (!activeDrawer) setSelectedPoint(event.latlng.lat, event.latlng.lng);
});
map.on(L.Draw.Event.CREATED, event => {
  const layer = event.layer;
  styleAreaLayer(layer);
  drawnItems.addLayer(layer);
  setSelectedAreas({ fit: true });
  status.textContent = 'Suchgebiet hinzugefügt. Weitere Gebiete können zusätzlich eingezeichnet werden.';
});
map.on(L.Draw.Event.EDITED, () => setSelectedAreas());
map.on(L.Draw.Event.DELETED, () => setSelectedAreas());
map.on(L.Draw.Event.DRAWSTOP, () => {
  activeDrawer = null;
});

$('drawPolygonBtn').onclick = () => startDrawing('polygon');
$('drawRectBtn').onclick = () => startDrawing('rectangle');
$('drawCircleBtn').onclick = () => startDrawing('circle');
$('clearAreasBtn').onclick = () => {
  drawnItems.clearLayers();
  setSelectedAreas();
  status.textContent = 'Suchgebiete gelöscht.';
};

function locateUser({ moveMap = true } = {}) {
  if (!navigator.geolocation) {
    status.textContent = 'Geolokalisierung wird von diesem Browser nicht unterstützt.';
    return Promise.reject(new Error('Geolocation unavailable'));
  }

  status.textContent = 'Standortfreigabe wird abgefragt…';
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      position => {
        userLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };

        if (userLocationLayer) userLocationLayer.remove();
        userLocationLayer = L.circleMarker([userLocation.lat, userLocation.lng], {
          radius: 7
        }).addTo(map).bindPopup('Ihr Standort');

        if (moveMap) map.setView([userLocation.lat, userLocation.lng], 14);
        status.textContent = 'Standort erkannt.';
        resolve(userLocation);
      },
      error => {
        console.error(error);
        status.textContent = 'Standort konnte nicht gelesen werden. Bitte Standortfreigabe aktivieren.';
        reject(error);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  });
}

$('locateBtn').onclick = () => locateUser().catch(() => {});
$('searchBtn').onclick = search;
$('searchInput').addEventListener('keydown', event => {
  if (event.key === 'Enter') search();
});
$('closePanel').onclick = () => {
  document.body.classList.add('panelHidden');
  setTimeout(() => map.invalidateSize(), 0);
};

async function search() {
  const query = $('searchInput').value.trim();
  if (!query) return;

  status.textContent = 'Suche…';
  try {
    const firstResult = await searchPlace(query);
    setSelectedPoint(firstResult.lat, firstResult.lng, firstResult.label);
    map.setView([firstResult.lat, firstResult.lng], 15);
    status.textContent = '';
  } catch (error) {
    console.error(error);
    status.textContent = 'Kein passender Ort gefunden.';
  }
}

async function searchPlace(query) {
  const encoded = encodeURIComponent(query);

  try {
    const response = await fetchWithTimeout(
      `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=it,at,ch,de&accept-language=de&q=${encoded}`
    );
    if (response.ok) {
      const data = await response.json();
      if (data.length) {
        const firstResult = data[0];
        return {
          lat: Number(firstResult.lat),
          lng: Number(firstResult.lon),
          label: firstResult.display_name
        };
      }
    }
  } catch (error) {
    console.warn('Nominatim search failed, trying Photon.', error);
  }

  const response = await fetchWithTimeout(`https://photon.komoot.io/api/?q=${encoded}&limit=5&lang=de`);
  if (!response.ok) throw new Error('Search failed');

  const data = await response.json();
  const feature = data.features.find(item => ['IT', 'AT', 'CH', 'DE'].includes(item.properties.countrycode)) || data.features[0];
  if (!feature) throw new Error('Kein Treffer');

  const [lng, lat] = feature.geometry.coordinates;
  const props = feature.properties;
  const labelParts = [props.name, props.street, props.city, props.county, props.state, props.country]
    .filter(Boolean);
  return {
    lat: Number(lat),
    lng: Number(lng),
    label: [...new Set(labelParts)].join(', ')
  };
}

async function reversePlace(lat, lng) {
  try {
    const response = await fetchWithTimeout(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=12&accept-language=de`
    );
    if (!response.ok) throw new Error('Reverse lookup failed');
    const data = await response.json();
    const address = data.address || {};
    return address.village || address.town || address.city || address.municipality || address.county || data.display_name || '';
  } catch (error) {
    console.warn('Reverse lookup failed', error);
    return '';
  }
}

function destinationSamples(lat, lng, distance = 60) {
  const dy = distance / 111320;
  const dx = distance / (111320 * Math.cos(lat * Math.PI / 180));
  return [[lat, lng], [lat + dy, lng], [lat - dy, lng], [lat, lng + dx], [lat, lng - dx]];
}

async function elevations(points) {
  const lats = points.map(point => point[0]).join(',');
  const lngs = points.map(point => point[1]).join(',');
  const response = await fetchWithTimeout(
    `https://api.open-meteo.com/v1/elevation?latitude=${lats}&longitude=${lngs}`
  );
  if (!response.ok) throw new Error('Höhendienst nicht erreichbar');
  return (await response.json()).elevation;
}

async function overpass(lat, lng, radius = 500) {
  const roadRadius = Math.round(Math.max(500, Math.min(radius, 5000)));
  const buildingRadius = Math.round(Math.max(250, Math.min(radius, 1500)));
  const query = `[out:json][timeout:25];(way(around:${roadRadius},${lat},${lng})[highway];way(around:${roadRadius},${lat},${lng})[waterway];node(around:${roadRadius},${lat},${lng})[natural=spring];way(around:${buildingRadius},${lat},${lng})[building];);out center tags;`;
  const endpoints = [
    'https://overpass-api.de/api/interpreter',
    'https://z.overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter'
  ];

  for (const endpoint of endpoints) {
    try {
      const response = await fetchWithTimeout(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
        body: new URLSearchParams({ data: query })
      }, 9000);
      if (!response.ok) throw new Error(`Overpass ${response.status}`);
      return (await response.json()).elements;
    } catch (error) {
      console.warn(`${endpoint} failed`, error);
    }
  }

  throw new Error('Kartendetails nicht erreichbar');
}

function hav(a, b, c, d) {
  const radius = 6371000;
  const p = Math.PI / 180;
  const x = (c - a) * p;
  const y = (d - b) * p * Math.cos((a + c) * p / 2);
  return Math.sqrt(x * x + y * y) * radius;
}

function nearestDistance(elements, lat, lng, filter) {
  let min = Infinity;
  for (const element of elements.filter(filter)) {
    const point = element.center || element;
    if (point.lat && point.lon) min = Math.min(min, hav(lat, lng, point.lat, point.lon));
  }
  return isFinite(min) ? min : null;
}

function aspectFromElev(elevationsList) {
  const [center, north, south, east, west] = elevationsList;
  const dzdx = (east - west) / 120;
  const dzdy = (north - south) / 120;
  const deg = (Math.atan2(dzdx, dzdy) * 180 / Math.PI + 180) % 360;
  const names = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return {
    elevation: center,
    deg,
    name: names[Math.round(deg / 45) % 8],
    slope: Math.atan(Math.sqrt(dzdx * dzdx + dzdy * dzdy)) * 180 / Math.PI
  };
}

function sunHours(lat, lng, date) {
  let mins = 0;
  for (let minute = 0; minute < 1440; minute += 10) {
    const dt = new Date(date);
    dt.setMinutes(minute);
    if (SunCalc.getPosition(dt, lat, lng).altitude > 0) mins += 10;
  }
  return mins / 60;
}

function metric(title, value, state, detail = '') {
  return `<div class="card"><div class="cardRow"><strong>${escapeHtml(title)}</strong><span class="badge ${state}">${escapeHtml(value)}</span></div>${detail ? `<div class="muted">${escapeHtml(detail)}</div>` : ''}</div>`;
}

function linkCard(title, detail, links) {
  const buttons = links.map(link => `<a class="source-link" target="_blank" rel="noopener" href="${escapeHtml(link.href)}">${escapeHtml(link.label)}</a>`).join('');
  return `<div class="card"><div class="cardRow"><strong>${escapeHtml(title)}</strong><span class="badge good">Live</span></div><div class="muted">${escapeHtml(detail)}</div><div class="sourceGrid">${buttons}</div></div>`;
}

function sourcePreviewSection(title, detail, previews) {
  const cards = previews.map(preview => `
    <article class="sourcePreview">
      <div class="sourcePreviewTop">
        <strong>${escapeHtml(preview.title)}</strong>
        <span>${escapeHtml(preview.badge || 'Vorschau')}</span>
      </div>
      <p>${escapeHtml(preview.description)}</p>
      <div class="sourcePreviewMeta">${escapeHtml(preview.meta)}</div>
      <div class="sourcePreviewActions">
        <button type="button" class="secondary saveSearchCandidate" data-title="${escapeHtml(preview.title)}" data-url="${escapeHtml(preview.href)}" data-notes="${escapeHtml(preview.description)}">Merken</button>
        <a target="_blank" rel="noopener" href="${escapeHtml(preview.href)}">Original öffnen</a>
      </div>
    </article>
  `).join('');
  return `<div class="card sourceSection"><div class="cardRow"><strong>${escapeHtml(title)}</strong><span class="badge good">Live</span></div><div class="muted">${escapeHtml(detail)}</div><div class="sourcePreviewGrid">${cards}</div></div>`;
}

function googleMapsSearchUrl(label, lat, lng) {
  const query = label ? `${label} ${lat.toFixed(5)},${lng.toFixed(5)}` : `${lat},${lng}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

function allRegions() {
  return [...AUTO_REGION_SUGGESTIONS, ...storedRegions()];
}

function findRegionById(id) {
  return allRegions().find(region => region.id === id);
}

function regionCard(region, mode) {
  const tags = (region.tags || []).slice(0, 4).map(tag => `<span>${escapeHtml(tag)}</span>`).join('');
  const source = mode === 'auto' ? 'Vorschlag' : 'Suchregion';
  const actionText = mode === 'auto' ? 'Vorschlag prüfen' : 'Region prüfen';
  return `<article class="sourcePreview regionCard">
    <div class="sourcePreviewTop">
      <strong>${escapeHtml(region.name)}</strong>
      <span>${escapeHtml(region.badge || source)}</span>
    </div>
    <p>${escapeHtml(region.reason || 'Gespeicherter Suchraum fuer passende Angebote und Off-Market-Spuren.')}</p>
    ${tags ? `<div class="regionTags">${tags}</div>` : ''}
    <div class="sourcePreviewMeta">${escapeHtml(source)} · ${Number(region.lat).toFixed(4)}, ${Number(region.lng).toFixed(4)}</div>
    <div class="sourcePreviewActions">
      <button type="button" class="selectRegionBtn" data-region-id="${escapeHtml(region.id)}">${escapeHtml(actionText)}</button>
      <button type="button" class="secondary createRegionCandidateBtn" data-region-id="${escapeHtml(region.id)}">Off-Market merken</button>
    </div>
  </article>`;
}

function renderAutoSuggestions() {
  const target = $('autoSuggestions');
  if (!target) return;
  target.innerHTML = AUTO_REGION_SUGGESTIONS.map(region => regionCard(region, 'auto')).join('');
}

function renderSavedRegions() {
  const target = $('savedRegions');
  if (!target) return;
  const regions = storedRegions();
  target.innerHTML = regions.length
    ? regions.map(region => regionCard(region, 'saved')).join('')
    : '<div class="muted">Noch keine Region gespeichert. Ort suchen, Punkt antippen oder Flaeche einzeichnen und dann speichern.</div>';
  updateScoutDashboard();
}

function setScoutMode(mode) {
  const activeMode = mode === 'regions' ? 'regions' : 'auto';
  localStorage.setItem(SCOUT_MODE_KEY, activeMode);
  $('autoModeBtn')?.classList.toggle('active', activeMode === 'auto');
  $('regionModeBtn')?.classList.toggle('active', activeMode === 'regions');
  $('autoModePanel')?.classList.toggle('hidden', activeMode !== 'auto');
  $('regionModePanel')?.classList.toggle('hidden', activeMode !== 'regions');
}

function restoreRegionAreas(region) {
  if (!Array.isArray(region.areas) || !region.areas.length) return false;
  drawnItems.clearLayers();
  region.areas.map(storedToLayer).forEach(layer => {
    styleAreaLayer(layer);
    drawnItems.addLayer(layer);
  });
  setSelectedAreas({ fit: true });
  return true;
}

function applyStoredProfile(profile) {
  if (!profile) return;
  $('livingMin').value = profile.livingMin || '';
  $('refugeMode').checked = profile.refugeMode !== false;
  $('plotMin').value = profile.plotMin || '';
  $('buildingType').value = profile.buildingType || '';
  $('yearFrom').value = profile.yearFrom || '';
  $('locationPref').value = profile.locationPref || '';
}

function selectRegion(region, { analyze = true } = {}) {
  if (!region) return;
  setScoutMode(region.source === 'user' ? 'regions' : 'auto');
  applyStoredProfile(region.profile);
  if (!restoreRegionAreas(region)) {
    drawnItems.clearLayers();
    $('clearAreasBtn').disabled = true;
    setSelectedPoint(Number(region.lat), Number(region.lng), region.name);
    map.setView([Number(region.lat), Number(region.lng)], region.zoom || 13);
  }
  status.textContent = `${region.name} ist ausgewählt.`;
  if (analyze) setTimeout(() => $('analyzeBtn').click(), 50);
}

function saveCurrentRegion() {
  const nameInput = $('regionNameInput');
  const typedName = nameInput ? nameInput.value.trim() : '';
  const center = selected ? { lat: selected.lat, lng: selected.lng } : map.getCenter();
  const layers = getAreaLayers();
  const isAreaSelection = selected?.type === 'areas' && layers.length;
  const region = {
    id: `region-${Date.now()}`,
    name: typedName || (selected?.label && selected.label !== 'Ausgewählter Standort' ? selected.label : 'Eigene Suchregion'),
    lat: center.lat,
    lng: center.lng,
    zoom: map.getZoom(),
    badge: isAreaSelection ? 'Gebiet' : 'Region',
    reason: isAreaSelection
      ? 'Von euch eingezeichneter Suchbereich fuer Marktangebote und Off-Market-Kandidaten.'
      : 'Von euch gespeicherter Suchpunkt fuer Marktangebote und Off-Market-Kandidaten.',
    tags: isAreaSelection ? ['eingezeichnet', 'Suchgebiet', 'Off-Market'] : ['vordefiniert', 'Suche', 'Off-Market'],
    source: 'user',
    areas: isAreaSelection ? layers.map(layerToStored) : [],
    profile: currentProfile(),
    createdAt: new Date().toISOString()
  };
  const regions = storedRegions();
  regions.unshift(region);
  writeJson(REGION_KEY, regions.slice(0, 30));
  if (nameInput) nameInput.value = '';
  renderSavedRegions();
  setScoutMode('regions');
  status.textContent = 'Region gespeichert. Sie kann jetzt wiederholt geprüft werden.';
}

function createRegionCandidate(region) {
  if (!region) return;
  const target = {
    type: Array.isArray(region.areas) && region.areas.length ? 'areas' : 'region',
    lat: Number(region.lat),
    lng: Number(region.lng),
    label: region.name
  };
  const property = {
    id: `prop-${Date.now()}`,
    kind: 'off_market_region',
    stage: 'manual_review',
    title: `Off-Market Suchauftrag: ${region.name}`,
    url: googleMapsSearchUrl(region.name, Number(region.lat), Number(region.lng)),
    price: null,
    address: region.name,
    notes: `${region.reason || 'Region pruefen.'} Naechster Schritt: Gebaeude, freie Grundstuecke, Katasterspur und Kontaktweg legal klaeren.`,
    profile: region.profile || currentProfile(),
    target,
    analysis: lastAnalysis,
    createdAt: new Date().toISOString()
  };
  property.score = scoreImportedProperty(property);
  property.plan = acquisitionPlanFor(property);
  const properties = storedProperties();
  properties.unshift(property);
  writeJson(PROPERTY_KEY, properties.slice(0, 80));
  renderProperties();
  updateScoutDashboard();
  status.textContent = 'Off-Market-Spur als Kandidat gespeichert.';
}

function learningCard() {
  return `<div class="card learningCard">
    <div class="cardRow"><strong>Angebot kommentieren</strong><span class="badge good">lernt</span></div>
    <div class="muted">Nach dem Öffnen eines Angebots Titel oder Link eintragen, kurz bewerten und kommentieren. Daraus entstehen neue Suchsignale.</div>
    <label>Titel oder Kurzbeschreibung <input id="feedbackTitle" placeholder="z. B. Hof mit Bergblick, aber zu nah an Straße" /></label>
    <label>Angebotslink <input id="feedbackUrl" inputmode="url" placeholder="https://..." /></label>
    <label>Bewertung
      <select id="feedbackFit">
        <option value="positive">passt gut</option>
        <option value="maybe">prüfen</option>
        <option value="negative">passt nicht</option>
      </select>
    </label>
    <label>Kommentar <textarea id="feedbackComment" rows="3" placeholder="Was gefällt? Was ausschließen? Zum Beispiel: Alleinlage gut, Straße zu nah, zu modern, mehr Grundstück."></textarea></label>
    <div class="quickTags" aria-label="Schnelle Kommentare">
      <button type="button" data-feedback-tag="Alleinlage gefällt">Alleinlage</button>
      <button type="button" data-feedback-tag="Bergblick gefällt">Bergblick</button>
      <button type="button" data-feedback-tag="Bergpanorama ist entscheidend">Panorama</button>
      <button type="button" data-feedback-tag="Naturkulisse gefällt">Natur</button>
      <button type="button" data-feedback-tag="Refugium Charakter gefällt">Refugium</button>
      <button type="button" data-feedback-tag="zu nah an Straße">Straße</button>
      <button type="button" data-feedback-tag="Luxusvilla ausschließen">Luxusvilla</button>
      <button type="button" data-feedback-tag="zu modern">modern</button>
      <button type="button" data-feedback-tag="zu wenig Grundstück">Grundstück</button>
      <button type="button" data-feedback-tag="Renovierung ok">Renovierung</button>
    </div>
    <button id="saveFeedbackBtn" type="button">Kommentar speichern</button>
    <div id="feedbackStatus" class="muted"></div>
  </div>`;
}

function layerCenter(layer) {
  if (layer instanceof L.Circle) return layer.getLatLng();
  return layer.getBounds().getCenter();
}

function layerRadius(layer) {
  if (layer instanceof L.Circle) return layer.getRadius();
  const bounds = layer.getBounds();
  const center = bounds.getCenter();
  const corners = [
    bounds.getNorthWest(),
    bounds.getNorthEast(),
    bounds.getSouthWest(),
    bounds.getSouthEast()
  ];
  return Math.max(...corners.map(point => hav(center.lat, center.lng, point.lat, point.lng)));
}

function areaInSquareMeters(layer) {
  if (layer instanceof L.Circle) return Math.PI * layer.getRadius() * layer.getRadius();
  const latLngs = layer.getLatLngs()[0] || [];
  if (latLngs.length < 3) return 0;
  const origin = latLngs[0];
  const points = latLngs.map(point => {
    const x = hav(origin.lat, origin.lng, origin.lat, point.lng) * (point.lng < origin.lng ? -1 : 1);
    const y = hav(origin.lat, origin.lng, point.lat, origin.lng) * (point.lat < origin.lat ? -1 : 1);
    return { x, y };
  });
  let sum = 0;
  for (let index = 0; index < points.length; index += 1) {
    const next = points[(index + 1) % points.length];
    sum += points[index].x * next.y - next.x * points[index].y;
  }
  return Math.abs(sum / 2);
}

function pointInPolygon(point, polygon) {
  const latLngs = polygon.getLatLngs()[0] || [];
  let inside = false;
  for (let i = 0, j = latLngs.length - 1; i < latLngs.length; j = i, i += 1) {
    const xi = latLngs[i].lng;
    const yi = latLngs[i].lat;
    const xj = latLngs[j].lng;
    const yj = latLngs[j].lat;
    const intersects = ((yi > point.lat) !== (yj > point.lat)) &&
      (point.lng < (xj - xi) * (point.lat - yi) / (yj - yi) + xi);
    if (intersects) inside = !inside;
  }
  return inside;
}

function samplesForLayer(layer) {
  const center = layerCenter(layer);
  if (layer instanceof L.Circle) {
    const radius = Math.min(layer.getRadius() * 0.55, 800);
    const dy = radius / 111320;
    const dx = radius / (111320 * Math.cos(center.lat * Math.PI / 180));
    return [
      [center.lat, center.lng],
      [center.lat + dy, center.lng],
      [center.lat - dy, center.lng],
      [center.lat, center.lng + dx],
      [center.lat, center.lng - dx]
    ];
  }

  const bounds = layer.getBounds();
  const samples = [[center.lat, center.lng]];
  for (const latFactor of [0.25, 0.5, 0.75]) {
    for (const lngFactor of [0.25, 0.5, 0.75]) {
      const lat = bounds.getSouth() + (bounds.getNorth() - bounds.getSouth()) * latFactor;
      const lng = bounds.getWest() + (bounds.getEast() - bounds.getWest()) * lngFactor;
      if (pointInPolygon({ lat, lng }, layer)) samples.push([lat, lng]);
    }
  }
  return samples.slice(0, 5);
}

function currentProfile() {
  return {
    refugeMode: $('refugeMode').checked,
    livingMin: $('livingMin').value.trim(),
    plotMin: $('plotMin').value.trim(),
    buildingType: $('buildingType').value,
    yearFrom: $('yearFrom').value.trim(),
    locationPref: $('locationPref').value.trim()
  };
}

function profileTerms(profile) {
  return [
    profile.buildingType || 'Immobilie',
    profile.refugeMode ? 'Bergpanorama Naturkulisse Refugium ruhig Alleinlage rustikal' : '',
    profile.livingMin ? `ab ${profile.livingMin} m2 Wohnfläche` : '',
    profile.plotMin ? `ab ${profile.plotMin} m2 Grundstück` : '',
    profile.yearFrom ? `Baujahr ab ${profile.yearFrom}` : '',
    profile.locationPref
  ].filter(Boolean);
}

function emptyLearningProfile() {
  return {
    entries: [],
    positive: {},
    negative: {},
    maybe: {}
  };
}

function loadLearningProfile() {
  const profile = readJson(LEARNING_KEY, emptyLearningProfile());
  return {
    entries: Array.isArray(profile.entries) ? profile.entries : [],
    positive: profile.positive || {},
    negative: profile.negative || {},
    maybe: profile.maybe || {}
  };
}

function saveLearningProfile(profile) {
  profile.entries = profile.entries.slice(0, 80);
  writeJson(LEARNING_KEY, profile);
  renderLearningSummary();
}

function rankedTerms(bucket, limit = 6) {
  return Object.entries(bucket || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([term]) => term);
}

function learnedSearchTerms() {
  const profile = loadLearningProfile();
  return {
    positive: rankedTerms(profile.positive, 7),
    negative: rankedTerms(profile.negative, 6),
    maybe: rankedTerms(profile.maybe, 3)
  };
}

function defaultNegativeTerms(profile) {
  return profile.refugeMode
    ? ['luxusvilla', 'luxus', 'prestige', 'designer', 'neubau', 'penthouse']
    : [];
}

function normalizedWords(text) {
  const stopWords = new Set([
    'aber', 'alle', 'alles', 'auch', 'dass', 'der', 'die', 'das', 'den', 'dem', 'des',
    'ein', 'eine', 'einer', 'einem', 'einen', 'für', 'gut', 'ist', 'mit', 'nicht',
    'oder', 'sehr', 'und', 'von', 'wenig', 'viel', 'zwar', 'vermeiden'
  ]);
  return [...String(text).toLowerCase().matchAll(/[a-zäöüß]{4,}/g)]
    .map(match => match[0])
    .filter(word => !stopWords.has(word))
    .slice(0, 20);
}

function updateBucket(bucket, words, weight) {
  for (const word of words) {
    bucket[word] = Math.min(99, (bucket[word] || 0) + weight);
  }
}

function applyFeedbackLearning(entry) {
  const profile = loadLearningProfile();
  const titleAndComment = `${entry.title} ${entry.comment}`;
  const commentOnly = entry.comment || entry.title;
  const words = normalizedWords(entry.fit === 'negative' ? commentOnly : titleAndComment);
  const protectedNegativeTerms = new Set(['grundstück', 'wohnfläche', 'bergblick', 'bergpanorama', 'panorama', 'naturkulisse', 'refugium', 'alleinlage']);
  if (entry.fit === 'positive') updateBucket(profile.positive, words, 2);
  if (entry.fit === 'maybe') updateBucket(profile.maybe, words, 1);
  if (entry.fit === 'negative') updateBucket(profile.negative, words.filter(word => !protectedNegativeTerms.has(word)), 2);
  if (entry.fit === 'negative' && /zu wenig grundst|mehr grundst/i.test(commentOnly)) {
    updateBucket(profile.positive, ['grundstück'], 1);
  }
  profile.entries.unshift(entry);
  saveLearningProfile(profile);
}

function learnedQuery(profile, place) {
  const learned = learnedSearchTerms();
  const negativeTerms = [...new Set([...defaultNegativeTerms(profile), ...learned.negative])];
  return [
    ...profileTerms(profile),
    place,
    'kaufen',
    ...learned.positive,
    ...learned.maybe,
    ...negativeTerms.map(term => `-${term}`)
  ].filter(Boolean).join(' ');
}

function offMarketQuery(profile, place) {
  const learned = learnedSearchTerms();
  const negativeTerms = [...new Set([...defaultNegativeTerms(profile), ...learned.negative])];
  return [
    'Satellitenbild',
    'Kataster',
    'Flurstück',
    'Hofstelle',
    'Grundstück',
    profile.refugeMode ? 'Bergpanorama Naturkulisse Alleinlage Refugium' : '',
    place,
    ...learned.positive,
    ...negativeTerms.map(term => `-${term}`)
  ].filter(Boolean).join(' ');
}

function sourceSearchUrl(sourceDomain, query) {
  return `https://www.google.com/search?q=${encodeURIComponent(`${query} site:${sourceDomain}`)}`;
}

function propertySourceCard(placeLabel) {
  const profile = currentProfile();
  const place = placeLabel || selected?.label || 'Alpenregion';
  const query = learnedQuery(profile, place);
  const offMarket = offMarketQuery(profile, place);
  const learned = learnedSearchTerms();
  const learnedParts = [
    profile.refugeMode ? 'Grundausrichtung: Bergpanorama, Naturkulisse, Refugium, keine Luxusvilla' : '',
    learned.positive.length ? `bevorzugt: ${learned.positive.join(', ')}` : '',
    learned.negative.length ? `meidet: ${learned.negative.join(', ')}` : ''
  ].filter(Boolean);
  const allDomains = [
    'immobiliare.it',
    'idealista.it',
    'casa.it',
    'subito.it',
    'immoscout24.at',
    'willhaben.at',
    'immoscout24.ch'
  ];
  const marketPreviews = [
    {
      title: 'Alle relevanten Quellen',
      badge: 'Meta',
      description: `Sucht marktöffentliche Treffer für ${place} mit Refugium-Profil und Ausschlüssen.`,
      meta: 'Portalübergreifende Suche',
      href: `https://www.google.com/search?q=${encodeURIComponent(`${query} (${allDomains.map(domain => `site:${domain}`).join(' OR ')})`)}`
    },
    { title: 'Immobiliare.it', description: `Italienische Angebote rund um ${place}, gefiltert auf Hof, Refugium, Natur und Panorama.`, meta: 'Marktangebot', href: sourceSearchUrl('immobiliare.it', query) },
    { title: 'Idealista', description: `Weitere Marktangebote mit Fokus auf Lage, Grundstück und Charakter.`, meta: 'Marktangebot', href: sourceSearchUrl('idealista.it', query) },
    { title: 'Casa.it', description: `Zusätzliche italienische Angebotsquelle für Häuser, Höfe und Grundstücke.`, meta: 'Marktangebot', href: sourceSearchUrl('casa.it', query) },
    { title: 'Subito', description: `Lokale Anzeigen und private Inserate prüfen.`, meta: 'Kleinanzeigen', href: sourceSearchUrl('subito.it', query) },
    { title: 'AT/CH Portale', description: `Grenznahe Alpenregionen in Österreich und Schweiz mit demselben Suchprofil.`, meta: 'Erweiterte Region', href: `https://www.google.com/search?q=${encodeURIComponent(`${query} (site:immoscout24.at OR site:willhaben.at OR site:immoscout24.ch)`)}` }
  ];
  const offMarketPreviews = [
    { title: 'Satellitenprüfung', badge: 'Karte', description: `Gebäude, Hofstellen und freie Grundstücke um ${place} visuell prüfen.`, meta: 'Off-Market Recherche', href: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place)}` },
    { title: 'Kataster-/Flurstückspur', badge: 'Prüfung', description: `Legale Hinweise zu Flurstücken, Kataster und Grundbuch vorbereiten.`, meta: 'Keine Eigentümerdaten ohne Freigabe', href: `https://www.google.com/search?q=${encodeURIComponent(`${offMarket} Südtirol Kataster Grundbuch`)}` },
    { title: 'Off-Market Hinweise', badge: 'Recherche', description: `Nicht inserierte Hofstellen, Sonderimmobilien und Grundstückshinweise suchen.`, meta: 'Vorqualifizierung', href: `https://www.google.com/search?q=${encodeURIComponent(offMarket)}` }
  ];
  const detail = learnedParts.length
    ? `Vorgefilterte Live-Suche nach Wunschprofil und gelerntem Feedback (${learnedParts.join(' / ')}).`
    : 'Vorgefilterte Live-Suche nach Wunschprofil. Kommentare zu Angeboten verbessern die nächsten Suchen.';
  const offMarketDetail = 'Separate Spur für Objekte, die nicht sichtbar angeboten werden: Hofstellen, Gebäude und Grundstücke werden über Satellit, Karte und Katasterhinweise weiter geprüft.';
  return sourcePreviewSection('A) Markt-Vorschauen', detail, marketPreviews) +
    sourcePreviewSection('B) Off-Market-Vorschauen', offMarketDetail, offMarketPreviews) +
    learningCard();
}

function bindLearningControls(placeLabel) {
  activeSuggestionPlace = placeLabel || activeSuggestionPlace || selected?.label || '';
  const comment = $('feedbackComment');
  const saveButton = $('saveFeedbackBtn');
  if (!comment || !saveButton) return;

  document.querySelectorAll('[data-feedback-tag]').forEach(button => {
    button.onclick = () => {
      const tag = button.getAttribute('data-feedback-tag');
      comment.value = comment.value ? `${comment.value}, ${tag}` : tag;
      comment.focus();
    };
  });

  saveButton.onclick = () => {
    const entry = {
      title: $('feedbackTitle').value.trim(),
      url: normalizeExternalUrl($('feedbackUrl').value),
      fit: $('feedbackFit').value,
      comment: comment.value.trim(),
      place: activeSuggestionPlace,
      target: selected ? { type: selected.type, lat: selected.lat, lng: selected.lng, label: selected.label } : null,
      date: new Date().toISOString()
    };
    if (!entry.title && !entry.url && !entry.comment) {
      $('feedbackStatus').textContent = 'Bitte mindestens Titel, Link oder Kommentar eintragen.';
      return;
    }

    applyFeedbackLearning(entry);
    $('feedbackTitle').value = '';
    $('feedbackUrl').value = '';
    comment.value = '';
    $('feedbackFit').value = 'positive';
    $('feedbackStatus').textContent = 'Gespeichert. Die nächsten Angebotsquellen nutzen dieses Feedback.';
    status.textContent = 'Lernprofil aktualisiert.';
    refreshPropertySources();
    updateScoutDashboard();
  };
}

function refreshPropertySources() {
  const existingLearningCard = document.querySelector('.learningCard');
  if (!existingLearningCard || !activeSuggestionPlace) return;

  const cards = [...results.children];
  const firstSourceIndex = cards.findIndex(card => card.textContent.includes('A) Markt-Vorschauen'));
  if (firstSourceIndex < 0) return;
  cards.slice(firstSourceIndex).forEach(card => card.remove());
  results.insertAdjacentHTML('beforeend', propertySourceCard(activeSuggestionPlace));
  bindLearningControls(activeSuggestionPlace);
}

function renderLearningSummary() {
  const target = $('learningSummary');
  if (!target) return;

  const profile = loadLearningProfile();
  const positive = rankedTerms(profile.positive, 8);
  const negative = rankedTerms(profile.negative, 8);
  const maybe = rankedTerms(profile.maybe, 6);
  const latest = profile.entries.slice(0, 3);

  target.innerHTML = `
    <div class="learnStats">
      <span>${profile.entries.length} Kommentare</span>
      <span>${positive.length} Vorlieben</span>
      <span>${negative.length} Ausschlüsse</span>
    </div>
    ${positive.length ? `<div class="chipRow"><strong>Bevorzugt</strong>${positive.map(term => `<span>${escapeHtml(term)}</span>`).join('')}</div>` : ''}
    ${negative.length ? `<div class="chipRow"><strong>Ausschließen</strong>${negative.map(term => `<span>${escapeHtml(term)}</span>`).join('')}</div>` : ''}
    ${maybe.length ? `<div class="chipRow"><strong>Prüfen</strong>${maybe.map(term => `<span>${escapeHtml(term)}</span>`).join('')}</div>` : ''}
    ${latest.length ? `<div class="learnHistory">${latest.map(entry => `<div><strong>${escapeHtml(entry.fit === 'negative' ? 'passt nicht' : entry.fit === 'maybe' ? 'prüfen' : 'passt')}</strong> ${escapeHtml(entry.title || entry.comment || entry.url)}</div>`).join('')}</div>` : '<div class="muted">Noch kein Feedback gespeichert.</div>'}
  `;
}

function parsePrice(value) {
  const cleaned = String(value || '').replace(/[^\d]/g, '');
  return cleaned ? Number(cleaned) : null;
}

function parseArea(value) {
  const cleaned = String(value || '').replace(/[^\d]/g, '');
  return cleaned ? Number(cleaned) : null;
}

function sourceNameFromUrl(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch (error) {
    return 'Objektquelle';
  }
}

function normalizeExternalUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  try {
    const parsed = new URL(raw);
    return ['http:', 'https:'].includes(parsed.protocol) ? parsed.href : '';
  } catch (error) {
    try {
      const parsed = new URL(`https://${raw}`);
      return parsed.hostname.includes('.') ? parsed.href : '';
    } catch (innerError) {
      return '';
    }
  }
}

function imageUrlsFromInput(value) {
  return String(value || '')
    .split(/[\n,]+/)
    .map(item => normalizeExternalUrl(item))
    .filter(Boolean)
    .slice(0, 2);
}

function profileFitFromText(text) {
  const words = String(text || '').toLowerCase();
  let score = 0;
  const positives = ['hof', 'bauernhaus', 'scheune', 'stall', 'nebeng', 'panorama', 'bergblick', 'alleinlage', 'ruhig', 'wald', 'quelle', 'bach', 'sanierung', 'historisch', 'alt'];
  const negatives = ['luxus', 'villa', 'penthouse', 'neubau', 'designer', 'prestige', 'stadtwohnung'];
  positives.forEach(term => {
    if (words.includes(term)) score += 4;
  });
  negatives.forEach(term => {
    if (words.includes(term)) score -= 8;
  });
  return Math.max(-20, Math.min(30, score));
}

function scoreImportedProperty(property) {
  const analysis = property.analysis || {};
  const geoScore = Number.isFinite(analysis.score) ? analysis.score : 45;
  const textScore = profileFitFromText(`${property.title} ${property.address} ${property.notes}`);
  const price = property.price;
  const priceSignal = price == null ? 0 : price < 1200000 ? 8 : price < 2200000 ? 2 : -8;
  const dataPenalty = property.url ? 0 : -6;
  const panoramaScore = Math.round(Math.max(20, Math.min(98,
    46 + textScore + (analysis.aspect && ['S', 'SE', 'SW'].includes(analysis.aspect) ? 12 : 0) + (analysis.elevation ? 8 : 0)
  )));
  const sunScore = Math.round(Math.max(20, Math.min(98, analysis.winter ? analysis.winter / 8 * 82 : 48)));
  const plotScore = Math.round(Math.max(20, Math.min(96,
    48 + (analysis.slope != null && analysis.slope <= Number($('slopeMax').value) ? 16 : -8) + (analysis.waterHint ? 10 : 0)
  )));
  const characterScore = Math.round(Math.max(15, Math.min(98, 52 + textScore * 1.5)));
  const accessScore = Math.round(Math.max(15, Math.min(95,
    analysis.road == null ? 42 : 82 - Math.min(38, analysis.road / 20)
  )));
  const legalScore = property.kind === 'off_market_region' ? 28 : 44;
  const priceScore = Math.round(Math.max(20, Math.min(90, price == null ? 42 : price < 1200000 ? 76 : price < 2200000 ? 58 : 38)));
  const dataQuality = Math.max(25, Math.min(90, 42 + (property.url ? 15 : 0) + (property.address ? 12 : 0) + (price != null ? 10 : 0) + (analysis.score ? 11 : 0)));
  const breakdown = {
    panorama: panoramaScore,
    sun: sunScore,
    plot: plotScore,
    character: characterScore,
    access: accessScore,
    legal: legalScore,
    price: priceScore,
    dataQuality
  };
  const score = Math.round(Math.max(0, Math.min(100,
    geoScore * 0.35 +
    breakdown.panorama * 0.16 +
    breakdown.sun * 0.12 +
    breakdown.plot * 0.11 +
    breakdown.character * 0.12 +
    breakdown.access * 0.08 +
    breakdown.price * 0.04 +
    breakdown.legal * 0.02 +
    priceSignal +
    dataPenalty
  )));
  const strengths = [];
  const risks = [];
  const next = [];

  if (geoScore >= 70) strengths.push('starke Standortvorprüfung');
  if (analysis.winter >= 5) strengths.push('brauchbare Wintersonne');
  if (analysis.waterHint) strengths.push('Wasserhinweis in der Nähe');
  if (textScore > 8) strengths.push('Beschreibung passt zum Refugium-Profil');
  if (price != null && price < 1200000) strengths.push('Preis wirkt prüfenswert');
  if (analysis.slope > Number($('slopeMax').value)) risks.push('Hangneigung prüfen');
  if (analysis.road == null) risks.push('Zufahrt/Wegerecht unklar');
  if (!property.url) risks.push('Angebotsquelle fehlt');
  if (price == null) risks.push('Preis fehlt');
  if (!property.address) risks.push('Adresse/Lage nur grob');

  next.push('Angebot manuell gegen Originalquelle prüfen');
  next.push('Flurstück/Katasterdaten legal ermitteln');
  next.push('Baurecht und Widmung fachlich prüfen');
  next.push('Sanierungs- und Erschließungsaufwand schätzen');

  return {
    total: score,
    dataQuality,
    breakdown,
    strengths: strengths.length ? strengths : ['erste Vorqualifizierung möglich'],
    risks: risks.length ? risks : ['keine harten Dealbreaker aus dem Prototyp erkennbar'],
    next
  };
}

function acquisitionPlanFor(property) {
  const place = property.target?.label || property.address || 'Objektlage';
  return [
    {
      id: 'source',
      title: 'Originalquelle sichern',
      status: property.url ? 'bereit' : 'offen',
      detail: property.url ? 'Link vorhanden, Originalangaben manuell prüfen.' : 'Angebotslink fehlt.'
    },
    {
      id: 'parcel',
      title: 'Flurstück/Kataster legal klären',
      status: 'offen',
      detail: `${place}: Kataster/Grundbuch nur über zulässige Dienste oder Fachpartner prüfen.`
    },
    {
      id: 'zoning',
      title: 'Widmung und Baurecht prüfen',
      status: 'offen',
      detail: 'Gemeinde, Geometer oder Architekt einbeziehen; keine rechtliche Sicherheit aus Kartendaten ableiten.'
    },
    {
      id: 'value',
      title: 'Preisspanne vorbereiten',
      status: property.price ? 'teilweise' : 'offen',
      detail: property.price ? 'Angebotspreis vorhanden; Vergleichswerte und Sanierungskosten fehlen.' : 'Preis fehlt.'
    },
    {
      id: 'contact',
      title: 'Kontaktentwurf vorbereiten',
      status: 'wartet',
      detail: 'Keine Nachricht ohne Freigabe. Erst Empfänger und Zweck klären.'
    }
  ];
}

function currentTargetSnapshot() {
  if (!selected) return null;
  return {
    type: selected.type,
    lat: selected.lat,
    lng: selected.lng,
    label: selected.label
  };
}

function saveImportedProperty() {
  const title = $('listingTitle').value.trim();
  const url = normalizeExternalUrl($('listingUrl').value);
  const imageUrls = imageUrlsFromInput($('listingImages').value);
  const price = parsePrice($('listingPrice').value);
  const livingArea = parseArea($('listingLiving').value);
  const plotArea = parseArea($('listingPlot').value);
  const address = $('listingAddress').value.trim();
  const notes = $('listingNotes').value.trim();

  if (!title && !url) {
    status.textContent = 'Bitte mindestens Titel oder Angebotslink eintragen.';
    return;
  }
  if (!selected) {
    status.textContent = 'Bitte zuerst einen Standort oder ein Suchgebiet wählen.';
    return;
  }

  const property = {
    id: `prop-${Date.now()}`,
    kind: 'market_listing',
    stage: 'auto_scored',
    title: title || 'Öffentliches Angebot',
    url,
    imageUrls,
    price,
    livingArea,
    plotArea,
    address,
    notes,
    profile: currentProfile(),
    target: currentTargetSnapshot(),
    analysis: lastAnalysis,
    createdAt: new Date().toISOString()
  };
  property.score = scoreImportedProperty(property);
  property.plan = acquisitionPlanFor(property);

  const properties = readJson(PROPERTY_KEY, []);
  properties.unshift(property);
  writeJson(PROPERTY_KEY, properties.slice(0, 80));
  $('listingTitle').value = '';
  $('listingUrl').value = '';
  $('listingImages').value = '';
  $('listingPrice').value = '';
  $('listingLiving').value = '';
  $('listingPlot').value = '';
  $('listingAddress').value = '';
  $('listingNotes').value = '';
  updateListingPreview();
  renderProperties();
  updateScoutDashboard();
  status.textContent = 'Objekt bewertet und gespeichert.';
}

function saveSearchCandidate(button) {
  if (!selected) {
    status.textContent = 'Bitte zuerst einen Standort oder ein Suchgebiet wählen.';
    return;
  }
  const property = {
    id: `prop-${Date.now()}`,
    kind: 'source_preview',
    stage: 'manual_review',
    title: button.dataset.title || 'Suchvorschau',
    url: normalizeExternalUrl(button.dataset.url),
    price: null,
    address: selected.label,
    notes: button.dataset.notes || 'Aus Suchvorschau gemerkt.',
    profile: currentProfile(),
    target: currentTargetSnapshot(),
    analysis: lastAnalysis,
    createdAt: new Date().toISOString()
  };
  property.score = scoreImportedProperty(property);
  property.plan = acquisitionPlanFor(property);
  const properties = storedProperties();
  properties.unshift(property);
  writeJson(PROPERTY_KEY, properties.slice(0, 80));
  renderProperties();
  updateScoutDashboard();
  status.textContent = 'Vorschau als Kandidat gespeichert.';
}

function imageStrip(imageUrls = [], title = 'Objekt') {
  const images = Array.isArray(imageUrls) ? imageUrls.filter(Boolean).slice(0, 2) : [];
  if (!images.length) {
    return `<div class="propertyImagePlaceholder"><span>Bild fehlt</span><strong>${escapeHtml(title)}</strong></div>`;
  }
  return `<div class="propertyImageStrip">${images.map((src, index) => `
    <img src="${escapeHtml(src)}" alt="${escapeHtml(`${title} Bild ${index + 1}`)}" loading="lazy" />
  `).join('')}</div>`;
}

function propertyFactLine(property) {
  const price = property.price == null ? 'Preis offen' : `${property.price.toLocaleString('de-DE')} €`;
  const facts = [
    price,
    property.livingArea ? `${property.livingArea.toLocaleString('de-DE')} m² Wohnfläche` : '',
    property.plotArea ? `${property.plotArea.toLocaleString('de-DE')} m² Grundstück` : '',
    property.address || property.target?.label || 'Lage offen'
  ].filter(Boolean);
  return facts.join(' · ');
}

function updateListingPreview() {
  const preview = $('listingPreview');
  if (!preview) return;
  const title = $('listingTitle').value.trim();
  const url = normalizeExternalUrl($('listingUrl').value);
  const imageUrls = imageUrlsFromInput($('listingImages').value);
  const price = parsePrice($('listingPrice').value);
  const livingArea = parseArea($('listingLiving').value);
  const plotArea = parseArea($('listingPlot').value);
  const address = $('listingAddress').value.trim();
  const notes = $('listingNotes').value.trim();

  if (!title && !url && !imageUrls.length && !address && !notes) {
    preview.classList.add('hidden');
    preview.innerHTML = '';
    return;
  }

  const displayTitle = title || sourceNameFromUrl(url);
  const priceText = price == null ? 'Preis offen' : `${price.toLocaleString('de-DE')} €`;
  const facts = [
    priceText,
    livingArea ? `${livingArea.toLocaleString('de-DE')} m² Wohnfläche` : '',
    plotArea ? `${plotArea.toLocaleString('de-DE')} m² Grundstück` : '',
    address || 'Lage prüfen'
  ].filter(Boolean).join(' · ');
  preview.classList.remove('hidden');
  preview.innerHTML = `<div class="sourcePreview pastedPreview">
    ${imageStrip(imageUrls, displayTitle)}
    <div class="sourcePreviewTop"><strong>${escapeHtml(displayTitle)}</strong><span>Objekt</span></div>
    <p>${escapeHtml(facts)}</p>
    <div class="sourcePreviewMeta">${escapeHtml(notes || 'Noch keine Notizen')}</div>
    ${url ? `<div class="sourcePreviewActions"><a target="_blank" rel="noopener" href="${escapeHtml(url)}">Original öffnen</a></div>` : ''}
  </div>`;
}

function scoreBreakdown(property) {
  const breakdown = property.score?.breakdown || {};
  const items = [
    ['Panorama', breakdown.panorama],
    ['Sonne', breakdown.sun],
    ['Grundstück', breakdown.plot],
    ['Charakter', breakdown.character],
    ['Erreichbarkeit', breakdown.access],
    ['Recht/offen', breakdown.legal],
    ['Preis', breakdown.price],
    ['Daten', breakdown.dataQuality]
  ];
  return `<div class="scoreBreakdown">${items.map(([label, value]) => `
    <span><strong>${escapeHtml(label)}</strong>${Number.isFinite(value) ? Math.round(value) : 'unklar'}</span>
  `).join('')}</div>`;
}

function householdVoteSummary(property) {
  const votes = property.votes || {};
  const labelFor = vote => {
    if (!vote) return 'offen';
    if (vote.fit === 'love') return 'Top';
    if (vote.fit === 'maybe') return 'Prüfen';
    if (vote.fit === 'no') return 'Nein';
    return 'offen';
  };
  return `<div class="householdVotes">
    <div><strong>Robert</strong><span>${escapeHtml(labelFor(votes.robert))}</span></div>
    <div><strong>Partnerin</strong><span>${escapeHtml(labelFor(votes.partner))}</span></div>
  </div>`;
}

function propertyCard(property) {
  const source = property.url ? `<a target="_blank" rel="noopener" href="${escapeHtml(property.url)}">Quelle öffnen</a>` : '<span>Quelle fehlt</span>';
  const plan = property.plan || acquisitionPlanFor(property);
  return `<div class="propertyCard">
    ${imageStrip(property.imageUrls, property.title)}
    <div class="cardRow"><strong>${escapeHtml(property.title)}</strong><span class="badge ${property.score.total >= 75 ? 'good' : property.score.total >= 55 ? 'warn' : 'bad'}">${property.score.total}/100</span></div>
    <div class="muted">${escapeHtml(propertyFactLine(property))} · Datenqualität ${property.score.dataQuality}/100</div>
    <div class="propertyMeta">${source}<span>${escapeHtml(property.stage)}</span></div>
    ${scoreBreakdown(property)}
    <div class="miniList"><strong>Stärken</strong>${property.score.strengths.map(item => `<span>${escapeHtml(item)}</span>`).join('')}</div>
    <div class="miniList"><strong>Risiken/offen</strong>${property.score.risks.map(item => `<span>${escapeHtml(item)}</span>`).join('')}</div>
    <div class="nextPlan"><strong>Nächste Prüfungen</strong>${plan.map(item => `<span>${escapeHtml(item.title)} · ${escapeHtml(item.status)}</span>`).join('')}</div>
    ${householdVoteSummary(property)}
    <div class="voteActions">
      <button type="button" onclick="voteProperty('${property.id}','robert','love')">Robert Top</button>
      <button type="button" class="secondary" onclick="voteProperty('${property.id}','robert','maybe')">Robert prüfen</button>
      <button type="button" class="secondary" onclick="voteProperty('${property.id}','robert','no')">Robert nein</button>
      <button type="button" onclick="voteProperty('${property.id}','partner','love')">Partnerin Top</button>
      <button type="button" class="secondary" onclick="voteProperty('${property.id}','partner','maybe')">Partnerin prüfen</button>
      <button type="button" class="secondary" onclick="voteProperty('${property.id}','partner','no')">Partnerin nein</button>
    </div>
    <div class="propertyActions">
      <button type="button" onclick="markProperty('${property.id}','interesting')">Interessant</button>
      <button type="button" class="secondary" onclick="markProperty('${property.id}','manual_review')">Prüfen</button>
      <button type="button" class="secondary" onclick="markProperty('${property.id}','rejected')">Verwerfen</button>
    </div>
  </div>`;
}

function nextSwipeProperty() {
  return storedProperties().find(property =>
    !property.quickReview &&
    !['rejected', 'acquired'].includes(property.stage)
  );
}

function renderSwipeDeck() {
  const target = $('swipeDeck');
  if (!target) return;
  const property = nextSwipeProperty();
  if (!property) {
    target.innerHTML = '<div class="muted">Keine offenen Objektvorschauen. Neue Kandidaten erscheinen hier automatisch.</div>';
    return;
  }

  const source = property.url ? `<a target="_blank" rel="noopener" href="${escapeHtml(property.url)}">Original öffnen</a>` : '<span>Quelle fehlt</span>';
  target.innerHTML = `<article class="swipeCard" data-property-id="${escapeHtml(property.id)}">
    ${imageStrip(property.imageUrls, property.title)}
    <div class="swipeHead">
      <div>
        <strong>${escapeHtml(property.title)}</strong>
        <span>${escapeHtml(propertyFactLine(property))}</span>
      </div>
      <b>${property.score.total}/100</b>
    </div>
    ${scoreBreakdown(property)}
    <p>${escapeHtml(property.notes || 'Noch keine Notiz. Original prüfen und Eindruck bewerten.')}</p>
    <div class="propertyMeta">${source}<span>${escapeHtml(property.kind || 'Kandidat')}</span></div>
    <label>Warum? <textarea id="swipeReason-${escapeHtml(property.id)}" rows="2" placeholder="optional: z. B. tolle Lage, zu touristisch, zu steil, falsches Haus..."></textarea></label>
    <div class="swipeActions">
      <button type="button" class="secondary swipeDecision" data-property-id="${escapeHtml(property.id)}" data-fit="negative">← Uninteressant</button>
      <button type="button" class="swipeDecision" data-property-id="${escapeHtml(property.id)}" data-fit="positive">Interessant →</button>
    </div>
    <div class="swipeHint">Auf dem Handy kann die Karte auch nach links oder rechts gewischt werden.</div>
  </article>`;
  bindSwipeGesture();
}

function bindSwipeGesture() {
  const card = document.querySelector('.swipeCard');
  if (!card) return;
  let startX = 0;
  let currentX = 0;
  card.onpointerdown = event => {
    if (event.target.closest('button, textarea, a')) return;
    startX = event.clientX;
    currentX = event.clientX;
    card.setPointerCapture(event.pointerId);
  };
  card.onpointermove = event => {
    if (!startX) return;
    currentX = event.clientX;
    const dx = currentX - startX;
    card.style.transform = `translateX(${Math.max(-90, Math.min(90, dx))}px) rotate(${dx / 20}deg)`;
  };
  card.onpointerup = () => {
    if (!startX) return;
    const dx = currentX - startX;
    card.style.transform = '';
    startX = 0;
    currentX = 0;
    if (Math.abs(dx) > 80) reviewPropertyQuick(card.dataset.propertyId, dx > 0 ? 'positive' : 'negative');
  };
}

function renderProperties() {
  const target = $('properties');
  if (!target) return;
  const properties = storedProperties();
  target.innerHTML = properties.length
    ? properties.map(propertyCard).join('')
    : '<div class="muted">Noch keine Objektkandidaten gespeichert.</div>';
  renderSwipeDeck();
  updateScoutDashboard();
}

window.markProperty = (id, stage) => {
  const properties = readJson(PROPERTY_KEY, []);
  const property = properties.find(item => item.id === id);
  if (!property) return;
  property.stage = stage;
  property.updatedAt = new Date().toISOString();
  if (stage === 'interesting') {
    property.plan = acquisitionPlanFor(property);
    writeJson(PROPERTY_KEY, properties);
    applyFeedbackLearning({
      title: property.title,
      url: property.url,
      fit: 'positive',
      comment: `${property.notes} unbedingt weiterverfolgen`,
      place: property.target?.label || '',
      target: property.target,
      date: new Date().toISOString()
    });
    status.textContent = 'Objekt als interessant markiert. Lernprofil aktualisiert.';
  } else {
    writeJson(PROPERTY_KEY, properties);
    status.textContent = `Objektstatus aktualisiert: ${stage}.`;
  }
  renderProperties();
  updateScoutDashboard();
};

window.voteProperty = (id, person, fit) => {
  const properties = readJson(PROPERTY_KEY, []);
  const property = properties.find(item => item.id === id);
  if (!property) return;
  const normalizedPerson = person === 'partner' ? 'partner' : 'robert';
  const voteFit = ['love', 'maybe', 'no'].includes(fit) ? fit : 'maybe';
  property.votes = property.votes || {};
  property.votes[normalizedPerson] = {
    fit: voteFit,
    date: new Date().toISOString()
  };
  property.updatedAt = new Date().toISOString();

  const both = property.votes.robert?.fit === 'love' && property.votes.partner?.fit === 'love';
  if (both) {
    property.stage = 'interesting';
    property.plan = acquisitionPlanFor(property);
  }

  writeJson(PROPERTY_KEY, properties);
  applyFeedbackLearning({
    title: property.title,
    url: property.url,
    fit: voteFit === 'no' ? 'negative' : voteFit === 'maybe' ? 'maybe' : 'positive',
    comment: `${normalizedPerson === 'robert' ? 'Robert' : 'Partnerin'}: ${voteFit === 'love' ? 'unbedingt weiterverfolgen' : voteFit === 'maybe' ? 'prüfen' : 'passt nicht'}`,
    place: property.target?.label || property.address || '',
    target: property.target,
    date: new Date().toISOString()
  });
  status.textContent = both
    ? 'Beide finden das Objekt stark. Es wurde als interessant markiert.'
    : 'Votum gespeichert. Das Suchprofil lernt daraus.';
  renderProperties();
  updateScoutDashboard();
};

function reviewPropertyQuick(id, fit) {
  const properties = readJson(PROPERTY_KEY, []);
  const property = properties.find(item => item.id === id);
  if (!property) return;
  const reason = $(`swipeReason-${id}`)?.value.trim() || '';
  const isPositive = fit === 'positive';
  property.stage = isPositive ? 'interesting' : 'rejected';
  property.quickReview = {
    fit: isPositive ? 'interesting' : 'uninteresting',
    reason,
    date: new Date().toISOString()
  };
  property.updatedAt = new Date().toISOString();
  if (isPositive) property.plan = acquisitionPlanFor(property);
  writeJson(PROPERTY_KEY, properties);
  applyFeedbackLearning({
    title: property.title,
    url: property.url,
    fit: isPositive ? 'positive' : 'negative',
    comment: reason || (isPositive ? 'Schnellbewertung: interessant' : 'Schnellbewertung: uninteressant'),
    place: property.target?.label || property.address || '',
    target: property.target,
    date: new Date().toISOString()
  });
  status.textContent = isPositive
    ? 'Als interessant gemerkt. Das Warum fließt ins Lernprofil.'
    : 'Als uninteressant aussortiert. Das Warum fließt ins Lernprofil.';
  renderProperties();
  updateScoutDashboard();
}

window.reviewPropertyQuick = reviewPropertyQuick;

async function analyzeSamples(samplePoints, center, radius, label, areaDescription = '') {
  const terrainResults = await Promise.allSettled(
    samplePoints.map(point => elevations(destinationSamples(point[0], point[1])))
  );
  const terrains = terrainResults
    .filter(result => result.status === 'fulfilled')
    .map(result => aspectFromElev(result.value));
  if (!terrains.length) throw new Error('Höhendienst nicht erreichbar');

  const [mapResult, reverseResult] = await Promise.allSettled([
    overpass(center.lat, center.lng, radius),
    reversePlace(center.lat, center.lng)
  ]);
  const mapElements = mapResult.status === 'fulfilled' ? mapResult.value : [];
  const mapDetailsAvailable = mapResult.status === 'fulfilled';
  const placeLabel = reverseResult.status === 'fulfilled' ? reverseResult.value : label;
  activeSuggestionPlace = placeLabel || label;

  const avgElevation = terrains.reduce((sum, terrain) => sum + terrain.elevation, 0) / terrains.length;
  const avgSlope = terrains.reduce((sum, terrain) => sum + terrain.slope, 0) / terrains.length;
  const primaryAspect = terrains.reduce((best, terrain) => {
    const count = terrains.filter(item => item.name === terrain.name).length;
    return count > best.count ? { name: terrain.name, deg: terrain.deg, count } : best;
  }, { name: terrains[0].name, deg: terrains[0].deg, count: 0 });

  const road = nearestDistance(mapElements, center.lat, center.lng, element => element.tags && element.tags.highway);
  const spring = nearestDistance(mapElements, center.lat, center.lng, element => element.tags && element.tags.natural === 'spring');
  const water = nearestDistance(mapElements, center.lat, center.lng, element => element.tags && element.tags.waterway);
  const buildings = mapElements.filter(element => element.tags && element.tags.building).length;
  const winter = sunHours(center.lat, center.lng, new Date('2026-12-21T00:00:00'));
  const summer = sunHours(center.lat, center.lng, new Date('2026-06-21T00:00:00'));
  const slopeMax = Number($('slopeMax').value);
  const roadMax = Number($('roadMax').value);
  const aspectPref = $('aspectPref').value;

  let score = 0;
  score += Math.max(0, 30 - avgSlope / slopeMax * 20);
  score += road == null ? 5 : Math.max(0, 25 - road / roadMax * 20);
  score += Math.min(20, winter / 8 * 20);
  score += aspectPref === 'ANY' ? 15 : (primaryAspect.name.includes(aspectPref) || primaryAspect.name === aspectPref ? 15 : 5);
  score += buildings ? 10 : 3;
  score = Math.round(Math.min(100, score));
  lastAnalysis = {
    score,
    label,
    areaDescription,
    elevation: avgElevation,
    slope: avgSlope,
    aspect: primaryAspect.name,
    aspectDeg: primaryAspect.deg,
    road,
    waterHint: spring != null ? 'spring' : water != null ? 'waterway' : '',
    buildings,
    winter,
    summer,
    mapDetailsAvailable,
    analyzedAt: new Date().toISOString()
  };

  $('score').innerHTML = `<div><div>Gesamteignung</div><small>${escapeHtml(label)}</small></div><strong>${score}/100</strong>`;
  $('score').classList.remove('hidden');
  results.innerHTML =
    (areaDescription ? metric('Suchbereich', areaDescription, 'good', `${samplePoints.length} Stichpunkte wurden innerhalb der Fläche geprüft.`) : '') +
    metric('Höhenlage', `Ø ${Math.round(avgElevation)} m`, 'good') +
    metric(
      'Hangneigung',
      `Ø ${avgSlope.toFixed(1)}°`,
      avgSlope <= slopeMax ? 'good' : avgSlope <= slopeMax + 8 ? 'warn' : 'bad',
      terrains.length === 1 ? 'Aus fünf Höhenpunkten im Umkreis von etwa 60 m geschätzt.' : 'Aus mehreren Stichpunkten innerhalb des Suchgebiets geschätzt.'
    ) +
    metric('Hangausrichtung', `${primaryAspect.name} · ${Math.round(primaryAspect.deg)}°`, ['S', 'SE', 'SW'].includes(primaryAspect.name) ? 'good' : 'warn') +
    metric('Astronomische Sonne', `${winter.toFixed(1)} h Winter / ${summer.toFixed(1)} h Sommer`, 'good', 'Noch ohne exakte Abschattung durch gegenüberliegende Berge.') +
    metric('Nächster kartierter Weg', !mapDetailsAvailable ? 'Kartendienst nicht erreichbar' : road == null ? 'nicht ermittelt' : `${Math.round(road)} m`, mapDetailsAvailable && road != null && road <= roadMax ? 'good' : 'warn', 'Kartierung beweist weder Befahrbarkeit noch Wegerecht.') +
    metric('Wasserhinweise', !mapDetailsAvailable ? 'Kartendienst nicht erreichbar' : spring != null ? `Quelle ca. ${Math.round(spring)} m` : water != null ? `Gewässer ca. ${Math.round(water)} m` : 'kein Eintrag im Suchradius', spring != null ? 'good' : water != null ? 'warn' : 'bad') +
    metric('Gebäudeumfeld', !mapDetailsAvailable ? 'Kartendienst nicht erreichbar' : `${buildings} kartierte Gebäude`, mapDetailsAvailable && buildings > 0 ? 'good' : 'warn', 'Anzahl im ungefähren Suchradius.') +
    propertySourceCard(placeLabel || label);
  bindLearningControls(placeLabel || label);

  status.textContent = mapDetailsAvailable
    ? 'Analyse abgeschlossen.'
    : 'Analyse abgeschlossen. Weg-, Wasser- und Gebäudehinweise konnten temporär nicht geladen werden.';
  updateScoutDashboard();
}

$('analyzeBtn').onclick = async () => {
  if (!selected) return;

  status.textContent = 'Gelände, Sonne, Umgebung und Angebotsquellen werden geprüft…';
  results.innerHTML = '';
  routeResult.innerHTML = '';
  try {
    if (selected.type === 'areas') {
      const layers = getAreaLayers();
      const bounds = L.featureGroup(layers).getBounds();
      const center = bounds.getCenter();
      const samples = layers.flatMap(layer => samplesForLayer(layer)).slice(0, 12);
      const radius = Math.max(...layers.map(layer => layerRadius(layer)), 500);
      const hectares = layers.reduce((sum, layer) => sum + areaInSquareMeters(layer), 0) / 10000;
      await analyzeSamples(samples, center, radius, selected.label, `${layers.length} Gebiet(e), ca. ${hectares.toFixed(1)} ha`);
      return;
    }

    await analyzeSamples([[selected.lat, selected.lng]], selected, 500, selected.label);
  } catch (error) {
    console.error(error);
    status.textContent = 'Ein Teil der öffentlichen Dienste war nicht erreichbar. Bitte erneut versuchen.';
  }
};

$('magicBtn').onclick = () => {
  if (!selected) {
    status.textContent = 'Bitte zuerst Ort suchen oder Suchgebiet einzeichnen.';
    return;
  }
  $('analyzeBtn').click();
};

$('routeBtn').onclick = async () => {
  if (!selected) return;

  routeResult.innerHTML = '';
  try {
    const origin = userLocation || await locateUser({ moveMap: false });
    const destination = selected;

    status.textContent = selected.type === 'areas' ? 'Anfahrt zum Mittelpunkt wird geprüft…' : 'Anfahrt wird geprüft…';
    const url = `https://router.project-osrm.org/route/v1/driving/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?overview=full&geometries=geojson&steps=true`;
    const response = await fetchWithTimeout(url, {}, 12000);
    if (!response.ok) throw new Error('Route failed');

    const data = await response.json();
    if (data.code !== 'Ok') throw new Error('Keine Route');

    const route = data.routes[0];
    if (routeLayer) routeLayer.remove();
    routeLayer = L.geoJSON(route.geometry, { style: { weight: 5, opacity: 0.8 } }).addTo(map);
    map.fitBounds(routeLayer.getBounds(), { padding: [30, 30] });

    const km = route.distance / 1000;
    const minutes = Math.round(route.duration / 60);
    const steps = route.legs[0].steps;
    const risky = steps.filter(step => /track|path|service|unclassified/i.test(step.name || '')).length;
    const last = steps.slice(-5).map(step => step.name).filter(Boolean);
    const lastNames = [...new Set(last)].join(', ');

    routeResult.innerHTML =
      metric('Fahrstrecke', `${km.toFixed(1)} km · ca. ${minutes} Min.`, 'good') +
      metric(
        'Letzte Zufahrt',
        risky ? `${risky} mögliche Nebenweg-Abschnitte` : 'keine Auffälligkeit im Routendienst',
        risky ? 'warn' : 'good',
        lastNames ? `Letzte Straßennamen: ${lastNames}` : 'Keine Straßennamen verfügbar.'
      ) +
      `<a class="route-link" target="_blank" rel="noopener" href="https://www.google.com/maps/dir/?api=1&destination=${destination.lat},${destination.lng}&travelmode=driving">Navigation in Google Maps öffnen</a>`;
    status.textContent = 'Route berechnet. Vor der Fahrt Satellitenbild und Straßenzustand prüfen.';
  } catch (error) {
    console.error(error);
    if (!/Geolocation/.test(error.message)) {
      status.textContent = 'Es konnte keine durchgehende Autoroute berechnet werden.';
    }
  }
};

function layerToStored(layer) {
  if (layer instanceof L.Circle) {
    const center = layer.getLatLng();
    return { type: 'circle', center: [center.lat, center.lng], radius: layer.getRadius() };
  }
  return { type: 'polygon', latlngs: (layer.getLatLngs()[0] || []).map(point => [point.lat, point.lng]) };
}

function storedToLayer(area) {
  if (area.type === 'circle') return L.circle(area.center, { radius: area.radius, ...areaStyle });
  return L.polygon(area.latlngs, areaStyle);
}

$('saveBtn').onclick = () => {
  if (!selected) return;
  const favorites = JSON.parse(localStorage.getItem('alpenFavorites') || '[]');
  if (selected.type === 'areas') {
    favorites.unshift({
      type: 'areas',
      label: selected.label,
      lat: selected.lat,
      lng: selected.lng,
      areas: getAreaLayers().map(layerToStored),
      profile: currentProfile(),
      date: new Date().toISOString()
    });
  } else {
    favorites.unshift({ ...selected, date: new Date().toISOString() });
  }
  localStorage.setItem('alpenFavorites', JSON.stringify(favorites.slice(0, 30)));
  renderFavorites();
  updateScoutDashboard();
  status.textContent = 'Favorit gespeichert.';
};

function renderFavorites() {
  const favorites = JSON.parse(localStorage.getItem('alpenFavorites') || '[]');
  $('favorites').innerHTML = favorites.length
    ? favorites.map((favorite, index) => {
      const isArea = favorite.type === 'areas';
      const title = isArea ? favorite.label : favorite.label.split(',')[0];
      const subtitle = isArea ? `${favorite.areas.length} Gebiet(e)` : `${favorite.lat.toFixed(5)}, ${favorite.lng.toFixed(5)}`;
      return `<div class="favorite"><div><strong>${escapeHtml(title)}</strong><div class="muted">${escapeHtml(subtitle)}</div></div><button onclick="openFav(${index})">Öffnen</button></div>`;
    }).join('')
    : '<div class="muted">Noch keine Standorte gespeichert.</div>';
}

window.openFav = index => {
  const favorites = JSON.parse(localStorage.getItem('alpenFavorites') || '[]');
  const favorite = favorites[index];
  if (!favorite) return;

  if (favorite.type === 'areas') {
    drawnItems.clearLayers();
    favorite.areas.map(storedToLayer).forEach(layer => {
      styleAreaLayer(layer);
      drawnItems.addLayer(layer);
    });
    applyStoredProfile(favorite.profile);
    setSelectedAreas({ fit: true });
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }

  setSelectedPoint(favorite.lat, favorite.lng, favorite.label);
  map.setView([favorite.lat, favorite.lng], 16);
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

$('slopeMax').oninput = event => {
  $('slopeOut').value = `${event.target.value}°`;
};
$('roadMax').oninput = event => {
  $('roadOut').value = `${event.target.value} m`;
};
$('clearLearningBtn').onclick = () => {
  writeJson(LEARNING_KEY, emptyLearningProfile());
  renderLearningSummary();
  refreshPropertySources();
  status.textContent = 'Lernprofil zurückgesetzt.';
  updateScoutDashboard();
};
$('saveListingBtn').onclick = saveImportedProperty;
$('exportDataBtn').onclick = exportDossier;
$('autoModeBtn').onclick = () => setScoutMode('auto');
$('regionModeBtn').onclick = () => setScoutMode('regions');
$('saveCurrentRegionBtn').onclick = saveCurrentRegion;
$('runRegionsBtn').onclick = () => {
  const regions = storedRegions();
  if (!regions.length) {
    status.textContent = 'Bitte zuerst eine Region speichern.';
    setScoutMode('regions');
    return;
  }
  selectRegion(regions[0], { analyze: true });
};
['listingTitle', 'listingUrl', 'listingImages', 'listingPrice', 'listingLiving', 'listingPlot', 'listingAddress', 'listingNotes'].forEach(id => {
  $(id).addEventListener('input', updateListingPreview);
});
document.addEventListener('click', event => {
  const sourceButton = event.target.closest('.saveSearchCandidate');
  if (sourceButton) saveSearchCandidate(sourceButton);

  const regionButton = event.target.closest('.selectRegionBtn');
  if (regionButton) selectRegion(findRegionById(regionButton.dataset.regionId), { analyze: true });

  const candidateButton = event.target.closest('.createRegionCandidateBtn');
  if (candidateButton) createRegionCandidate(findRegionById(candidateButton.dataset.regionId));

  const swipeButton = event.target.closest('.swipeDecision');
  if (swipeButton) reviewPropertyQuick(swipeButton.dataset.propertyId, swipeButton.dataset.fit);
});

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
renderAutoSuggestions();
renderSavedRegions();
setScoutMode(localStorage.getItem(SCOUT_MODE_KEY) || 'auto');
renderLearningSummary();
renderFavorites();
renderProperties();
updateScoutDashboard();
