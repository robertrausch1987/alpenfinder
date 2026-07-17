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

let selected = null;
let marker = null;
let userLocation = null;
let userLocationLayer = null;
let routeLayer = null;

const $ = id => document.getElementById(id);
const status = $('status');
const results = $('results');
const routeResult = $('routeResult');

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[char]);
}

function setSelected(lat, lng, label = 'Ausgewählter Standort') {
  selected = { lat, lng, label };
  document.body.classList.remove('panelHidden');

  if (marker) marker.remove();
  marker = L.marker([lat, lng], { draggable: true })
    .addTo(map)
    .bindPopup(escapeHtml(label))
    .openPopup();
  marker.on('dragend', event => {
    const point = event.target.getLatLng();
    setSelected(point.lat, point.lng, 'Verschobener Standort');
  });

  $('coords').textContent = `${label} · ${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  ['analyzeBtn', 'routeBtn', 'saveBtn'].forEach(id => {
    $(id).disabled = false;
  });
  results.innerHTML = '';
  routeResult.innerHTML = '';
  $('score').classList.add('hidden');
  setTimeout(() => map.invalidateSize(), 0);
}

map.on('click', event => setSelected(event.latlng.lat, event.latlng.lng));

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
    setSelected(firstResult.lat, firstResult.lng, firstResult.label);
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
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=it&accept-language=de&q=${encoded}`
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

  const response = await fetch(`https://photon.komoot.io/api/?q=${encoded}&limit=5&lang=de`);
  if (!response.ok) throw new Error('Search failed');

  const data = await response.json();
  const feature = data.features.find(item => item.properties.countrycode === 'IT') || data.features[0];
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

function destinationSamples(lat, lng, distance = 60) {
  const dy = distance / 111320;
  const dx = distance / (111320 * Math.cos(lat * Math.PI / 180));
  return [[lat, lng], [lat + dy, lng], [lat - dy, lng], [lat, lng + dx], [lat, lng - dx]];
}

async function elevations(points) {
  const lats = points.map(point => point[0]).join(',');
  const lngs = points.map(point => point[1]).join(',');
  const response = await fetch(
    `https://api.open-meteo.com/v1/elevation?latitude=${lats}&longitude=${lngs}`
  );
  if (!response.ok) throw new Error('Höhendienst nicht erreichbar');
  return (await response.json()).elevation;
}

async function overpass(lat, lng) {
  const query = `[out:json][timeout:20];(way(around:500,${lat},${lng})[highway];way(around:500,${lat},${lng})[waterway];node(around:500,${lat},${lng})[natural=spring];way(around:250,${lat},${lng})[building];);out center tags;`;
  const endpoints = [
    'https://overpass-api.de/api/interpreter',
    'https://z.overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter'
  ];

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
        body: new URLSearchParams({ data: query })
      });
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

$('analyzeBtn').onclick = async () => {
  if (!selected) return;

  status.textContent = 'Gelände, Sonne und Umgebung werden geprüft…';
  results.innerHTML = '';
  try {
    const points = destinationSamples(selected.lat, selected.lng);
    const [elevationResult, mapResult] = await Promise.allSettled([
      elevations(points),
      overpass(selected.lat, selected.lng)
    ]);
    if (elevationResult.status === 'rejected') throw elevationResult.reason;

    const elevationValues = elevationResult.value;
    const mapElements = mapResult.status === 'fulfilled' ? mapResult.value : [];
    const mapDetailsAvailable = mapResult.status === 'fulfilled';
    const terrain = aspectFromElev(elevationValues);
    const road = nearestDistance(
      mapElements,
      selected.lat,
      selected.lng,
      element => element.tags && element.tags.highway
    );
    const spring = nearestDistance(
      mapElements,
      selected.lat,
      selected.lng,
      element => element.tags && element.tags.natural === 'spring'
    );
    const water = nearestDistance(
      mapElements,
      selected.lat,
      selected.lng,
      element => element.tags && element.tags.waterway
    );
    const buildings = mapElements.filter(element => element.tags && element.tags.building).length;
    const winter = sunHours(selected.lat, selected.lng, new Date('2026-12-21T00:00:00'));
    const summer = sunHours(selected.lat, selected.lng, new Date('2026-06-21T00:00:00'));
    const slopeMax = Number($('slopeMax').value);
    const roadMax = Number($('roadMax').value);
    const aspectPref = $('aspectPref').value;

    let score = 0;
    score += Math.max(0, 30 - terrain.slope / slopeMax * 20);
    score += road == null ? 5 : Math.max(0, 25 - road / roadMax * 20);
    score += Math.min(20, winter / 8 * 20);
    score += aspectPref === 'ANY' ? 15 : (terrain.name.includes(aspectPref) || terrain.name === aspectPref ? 15 : 5);
    score += buildings ? 10 : 3;
    score = Math.round(Math.min(100, score));

    $('score').innerHTML = `<div><div>Gesamteignung</div><small>automatische Vorprüfung</small></div><strong>${score}/100</strong>`;
    $('score').classList.remove('hidden');
    results.innerHTML =
      metric('Höhenlage', `${Math.round(elevationValues[0])} m`, 'good') +
      metric(
        'Lokale Hangneigung',
        `${terrain.slope.toFixed(1)}°`,
        terrain.slope <= slopeMax ? 'good' : terrain.slope <= slopeMax + 8 ? 'warn' : 'bad',
        'Aus fünf Höhenpunkten im Umkreis von etwa 60 m geschätzt.'
      ) +
      metric('Hangausrichtung', `${terrain.name} · ${Math.round(terrain.deg)}°`, ['S', 'SE', 'SW'].includes(terrain.name) ? 'good' : 'warn') +
      metric('Astronomische Sonne', `${winter.toFixed(1)} h Winter / ${summer.toFixed(1)} h Sommer`, 'good', 'Noch ohne exakte Abschattung durch gegenüberliegende Berge.') +
      metric('Nächster kartierter Weg', !mapDetailsAvailable ? 'Kartendienst nicht erreichbar' : road == null ? 'nicht ermittelt' : `${Math.round(road)} m`, mapDetailsAvailable && road != null && road <= roadMax ? 'good' : 'warn', 'Kartierung beweist weder Befahrbarkeit noch Wegerecht.') +
      metric('Wasserhinweise', !mapDetailsAvailable ? 'Kartendienst nicht erreichbar' : spring != null ? `Quelle ca. ${Math.round(spring)} m` : water != null ? `Gewässer ca. ${Math.round(water)} m` : 'kein Eintrag im 500-m-Radius', spring != null ? 'good' : water != null ? 'warn' : 'bad') +
      metric('Gebäudeumfeld', !mapDetailsAvailable ? 'Kartendienst nicht erreichbar' : `${buildings} kartierte Gebäude`, mapDetailsAvailable && buildings > 0 ? 'good' : 'warn', 'Anzahl im ungefähren 250-m-Radius.');
    status.textContent = mapDetailsAvailable
      ? 'Analyse abgeschlossen.'
      : 'Analyse abgeschlossen. Weg-, Wasser- und Gebäudehinweise konnten temporär nicht geladen werden.';
  } catch (error) {
    console.error(error);
    status.textContent = 'Ein Teil der öffentlichen Kartendienste war nicht erreichbar. Bitte erneut versuchen.';
  }
};

$('routeBtn').onclick = async () => {
  if (!selected) return;

  routeResult.innerHTML = '';
  try {
    const origin = userLocation || await locateUser({ moveMap: false });
    const destination = selected;

    status.textContent = 'Anfahrt wird geprüft…';
    const url = `https://router.project-osrm.org/route/v1/driving/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?overview=full&geometries=geojson&steps=true`;
    const response = await fetch(url);
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

$('saveBtn').onclick = () => {
  if (!selected) return;
  const favorites = JSON.parse(localStorage.getItem('alpenFavorites') || '[]');
  favorites.unshift({ ...selected, date: new Date().toISOString() });
  localStorage.setItem('alpenFavorites', JSON.stringify(favorites.slice(0, 30)));
  renderFavorites();
  status.textContent = 'Favorit gespeichert.';
};

function renderFavorites() {
  const favorites = JSON.parse(localStorage.getItem('alpenFavorites') || '[]');
  $('favorites').innerHTML = favorites.length
    ? favorites.map((favorite, index) => `<div class="favorite"><div><strong>${escapeHtml(favorite.label.split(',')[0])}</strong><div class="muted">${favorite.lat.toFixed(5)}, ${favorite.lng.toFixed(5)}</div></div><button onclick="openFav(${index})">Öffnen</button></div>`).join('')
    : '<div class="muted">Noch keine Standorte gespeichert.</div>';
}

window.openFav = index => {
  const favorites = JSON.parse(localStorage.getItem('alpenFavorites') || '[]');
  const favorite = favorites[index];
  if (!favorite) return;

  setSelected(favorite.lat, favorite.lng, favorite.label);
  map.setView([favorite.lat, favorite.lng], 16);
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

$('slopeMax').oninput = event => {
  $('slopeOut').value = `${event.target.value}°`;
};
$('roadMax').oninput = event => {
  $('roadOut').value = `${event.target.value} m`;
};

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
renderFavorites();
