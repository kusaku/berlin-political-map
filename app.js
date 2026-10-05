import * as maplibregl from 'https://unpkg.com/maplibre-gl@6.10.0/dist/maplibre-gl.mjs';
import { buffer as insetFeature } from 'https://esm.sh/@turf/buffer@7.4.0';

const COLORS = {
  'Die Linke': '#d83ea5', CDU: '#c3ccd8', AfD: '#24a4f4', Greens: '#32d982',
  SPD: '#f35562', FDP: '#f2d242', BSW: '#ff8b4f', Pirates: '#f69b34',
  Volt: '#9063ff', 'Die PARTEI': '#f8739e', 'Animal Protection': '#85c967', Other: '#7e8c9d'
};
const LABELS = { Greens: 'Die Grünen', Other: 'Sonstige', Pirates: 'Piratenpartei', 'Animal Protection': 'Tierschutzpartei' };
const YEARS = ['2026', '2023', '2021', '2016', '2011'];
const $ = id => document.getElementById(id);
const fmt = new Intl.NumberFormat('en-US');
const pct = n => `${n.toFixed(1)}%`;
const state = { year: '2026', party: null, selected: null, hovered: null, map: null, bounds: null };
const LAYERS = ['gloss', 'surface', 'outlines', 'boroughs'];

function ranking(result) {
  return Object.entries(result?.votes || {}).map(([party, votes]) => ({ party, votes, share: votes / result.valid * 100 }))
    .sort((a, b) => b.votes - a.votes);
}

function current() { return state.elections[state.year]; }
function resultFor(id) { return id ? current().boroughs[id] : current().city; }
function boroughName(id) { return state.geo.features.find(f => f.properties.id === id)?.properties.name || 'Berlin'; }
function shareFor(result, party) { return result.votes[party] / result.valid * 100 || 0; }
function swatch(party) { return `<i class="swatch" style="background:${COLORS[party] || COLORS.Other}"></i>`; }
function partyName(party) { return LABELS[party] || party; }
function label(party) { return `<span class="table-party">${swatch(party)}${partyName(party)}</span>`; }

function tooltipContents(id) {
  const result = current().boroughs[id];
  const items = state.party
    ? [{ party: state.party, share: shareFor(result, state.party) }]
    : ranking(result);
  return `<strong>${boroughName(id)}</strong><div class="tooltip-results">${items.map(({ party, share }) => `<span>${swatch(party)}${partyName(party)}<b>${pct(share)}</b></span>`).join('')}</div>`;
}

function shade(color, amount) {
  const rgb = color.match(/\w\w/g).map(value => parseInt(value, 16));
  const base = [9, 18, 30];
  const weight = Math.min(1, 0.22 + amount / 42 * 0.78);
  return `rgb(${rgb.map((value, index) => Math.round(base[index] + (value - base[index]) * weight)).join(' ')})`;
}

function renderYears() {
  $('years').innerHTML = YEARS.map(year => `<button class="view-button${year === state.year ? ' is-active' : ''}" type="button" data-year="${year}" aria-pressed="${year === state.year}">${year}</button>`).join('');
  $('years').addEventListener('click', event => {
    const button = event.target.closest('[data-year]');
    if (!button || button.dataset.year === state.year) return;
    state.year = button.dataset.year;
    for (const item of $('years').children) {
      const active = item.dataset.year === state.year;
      item.setAttribute('aria-pressed', String(active));
      item.classList.toggle('is-active', active);
    }
    render();
  });
}

function renderDetails() {
  const election = current();
  const result = resultFor(state.selected);
  const items = ranking(result);
  $('identity-type').textContent = state.selected ? 'BERLIN BOROUGH' : 'CITY OVERVIEW';
  $('district-name').textContent = boroughName(state.selected);
  $('district-code').textContent = state.selected ? `BE ${state.selected}` : 'BERLIN';
  const flag = state.selected ? `assets/flags/${state.selected}.${Number(state.selected) > 10 ? 'gif' : 'svg'}` : 'assets/berlin.svg';
  if (!$('district-flag').src.endsWith(flag)) $('district-flag').src = flag;
  $('district-flag').alt = `${boroughName(state.selected)} flag`;
  $('district-subtitle').textContent = state.selected ? 'District election result' : 'All 12 boroughs combined';
  $('result-heading').textContent = `Assembly election · ${state.year}`;
  $('result-status').textContent = election.status === 'annulled' ? 'Annulled' : election.status === 'provisional' ? 'Provisional' : 'Final';
  $('result-status').classList.toggle('is-annulled', election.status === 'annulled');
  $('result-note').textContent = election.status === 'annulled'
    ? 'The 2021 election was annulled and repeated in 2023. Shown for historical comparison only.'
    : election.status === 'provisional' ? 'Preliminary official result; figures may change before certification.' : '';
  $('result-bars').innerHTML = items.slice(0, 8).map(({ party, share }) => `
    <div class="mini-row"><span class="party-name">${swatch(party)}${partyName(party)}</span>
      <span class="bar-track"><i class="bar-fill" style="--value:${share}%;--party-color:${COLORS[party] || COLORS.Other}"></i></span><span class="mini-value">${pct(share)}</span></div>`).join('');
  $('vote-total').textContent = `${fmt.format(result.valid)} valid votes`;
  $('result-source').href = election.source;
  $('table-year').textContent = state.year;
  $('data-status').textContent = `${state.year} official election snapshot · local JSON`;
}

function renderTable() {
  $('borough-table').innerHTML = state.geo.features.map(feature => {
    const id = feature.properties.id;
    const result = current().boroughs[id];
    const [winner, second] = ranking(result);
    return `<tr data-id="${id}" class="${state.selected === id ? 'is-selected' : ''}"><td>${feature.properties.name}</td><td>${label(winner.party)}</td><td><span class="table-rating">${pct(winner.share)}</span></td><td>${label(second.party)} · ${pct(second.share)}</td><td>${fmt.format(result.valid)}</td></tr>`;
  }).join('');
}

function renderPolls() {
  const polls = state.polls.surveys.filter(p => p.date >= '2026-01-01').slice(0, 3);
  const preElection = polls[0]?.date < state.elections['2026'].date;
  $('polls-heading').textContent = preElection ? 'Last pre-election polls' : 'Latest Berlin polling';
  $('polls-note').textContent = preElection
    ? 'These surveys sampled Berlin as a whole before the 2026 vote. They are not estimates for individual boroughs, nor a live post-election forecast.'
    : 'These surveys sample Berlin as a whole. They are not estimates for individual boroughs.';
  $('poll-cards').innerHTML = polls.map(poll => {
    const results = Object.entries(poll.results).sort((a, b) => b[1] - a[1]);
    return `<article class="poll-card"><header><h3>${poll.institute}</h3><time datetime="${poll.date}">${poll.date}</time></header>
      <p>${fmt.format(poll.sample)} respondents · Berlin-wide</p>
      <div class="poll-mini" aria-hidden="true">${results.map(([party, share]) => `<span style="width:${share}%;background:${COLORS[party] || COLORS.Other}"></span>`).join('')}</div>
      <div class="poll-values">${results.slice(0, 6).map(([party, share]) => `<span>${swatch(party)}${partyName(party)} ${share}%</span>`).join('')}</div></article>`;
  }).join('');
}

function mapProperties() {
  for (const feature of state.geo.features) {
    const result = current().boroughs[feature.properties.id];
    const winner = ranking(result)[0];
    const party = state.party || winner.party;
    const share = state.party ? shareFor(result, party) : winner.share;
    feature.properties.color = state.party ? shade(COLORS[party] || COLORS.Other, share) : COLORS[party] || COLORS.Other;
    feature.properties.height = state.party ? 80 + share * 48 : 420 + share * 35;
    feature.properties.summary = `${partyName(party)} · ${pct(share)}`;
  }
  state.map?.getSource('boroughs')?.setData(state.geo);
  state.map?.getSource('caps')?.setData(state.caps);
}

function renderLegend() {
  const parties = ranking(current().city).map(({ party }) => party);
  $('legend').innerHTML = parties.map(party => `<button class="legend-item${party === state.party ? ' is-active' : ''}" type="button" data-party="${party}" aria-pressed="${party === state.party}" title="Show ${partyName(party)} results">${swatch(party)}${partyName(party)}</button>`).join('');
  $('legend').onclick = event => {
    const party = event.target.closest('[data-party]')?.dataset.party;
    if (!party) return;
    state.party = state.party === party ? null : party;
    render();
  };
}

function render() {
  if (state.party && !current().city.votes[state.party]) state.party = null;
  $('view-description').textContent = state.party
    ? `Colour brightness and height show ${state.party}'s vote share.`
    : 'Colour shows the borough winner. Height shows vote share. Choose a party below to compare its result.';
  renderDetails(); renderTable(); mapProperties(); renderLegend();
}

function select(id) {
  if (state.selected === id) return;
  if (state.selected) setFeature(state.selected, { selected: false });
  state.selected = id;
  if (id) setFeature(id, { selected: true });
  renderDetails(); renderTable();
}

function setFeature(id, value) {
  for (const source of ['boroughs', 'caps']) state.map?.setFeatureState({ source, id }, value);
}

function featureValue(selected, hover, normal) {
  return ['case', ['boolean', ['feature-state', 'selected'], false], selected,
    ['boolean', ['feature-state', 'hover'], false], hover, normal];
}

function fitMap() {
  const mobile = window.matchMedia('(max-width: 650px)').matches;
  state.map.fitBounds(state.bounds, {
    padding: mobile ? { top: 34, right: 18, bottom: 78, left: 18 } : { top: 54, right: 60, bottom: 75, left: 60 },
    pitch: mobile ? 32 : 41, bearing: mobile ? -5 : -9, maxZoom: mobile ? 9.7 : 10.6, duration: 0
  });
}

function prepareGeometry() {
  state.bounds = new maplibregl.LngLatBounds();
  const extend = coordinates => {
    if (typeof coordinates[0] === 'number') state.bounds.extend(coordinates);
    else coordinates.forEach(extend);
  };
  state.geo.features.forEach(f => extend(f.geometry.coordinates));
  state.caps = { type: 'FeatureCollection', features: state.geo.features.map(feature => {
    const inset = insetFeature(feature, -0.12, { units: 'kilometers', steps: 2 });
    if (inset) inset.properties = feature.properties;
    return inset || feature;
  }) };
}

function initMap() {
  state.map = new maplibregl.Map({
    container: 'map', style: { version: 8, sources: {}, light: { anchor: 'viewport', color: '#fff', intensity: 0.82, position: [1.5, 145, 42] },
      layers: [{ id: 'background', type: 'background', paint: { 'background-color': 'rgba(3,5,8,0)' } }] },
    center: [13.405, 52.52], zoom: 9, minZoom: 8, maxZoom: 12.5, pitch: 41, bearing: -9,
    maxPitch: 70, antialias: true, renderWorldCopies: false, attributionControl: false
  });
  state.map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');
  state.map.on('load', () => {
    for (const [id, data] of [['boroughs', state.geo], ['caps', state.caps]]) {
      state.map.addSource(id, { type: 'geojson', data, promoteId: 'id', maxzoom: 10, tolerance: 0, buffer: 256 });
    }
    const top = ['+', ['get', 'height'], featureValue(200, 80, 0)];
    const color = featureValue('#eaff38', ['get', 'color'], ['get', 'color']);
    state.map.addLayer({ id: 'boroughs', type: 'fill-extrusion', source: 'boroughs', paint: {
      'fill-extrusion-color': color, 'fill-extrusion-height': top, 'fill-extrusion-base': 0,
      'fill-extrusion-opacity': .98, 'fill-extrusion-vertical-gradient': true } });
    state.map.addLayer({ id: 'outlines', type: 'fill-extrusion', source: 'boroughs', paint: {
      'fill-extrusion-color': '#060b12', 'fill-extrusion-height': ['+', top, 30], 'fill-extrusion-base': ['-', top, 45],
      'fill-extrusion-opacity': 1, 'fill-extrusion-vertical-gradient': false } });
    state.map.addLayer({ id: 'surface', type: 'fill-extrusion', source: 'caps', paint: {
      'fill-extrusion-color': color, 'fill-extrusion-height': ['+', top, 47], 'fill-extrusion-base': ['-', top, 15],
      'fill-extrusion-opacity': .99, 'fill-extrusion-vertical-gradient': false } });
    state.map.addLayer({ id: 'gloss', type: 'fill-extrusion', source: 'caps', paint: {
      'fill-extrusion-color': featureValue('#fff', '#fff', ['get', 'color']),
      'fill-extrusion-height': ['+', top, 53], 'fill-extrusion-base': ['+', top, 42],
      'fill-extrusion-opacity': .13, 'fill-extrusion-vertical-gradient': false } });
    fitMap();
    state.map.on('mousemove', event => {
      const feature = state.map.queryRenderedFeatures(event.point, { layers: LAYERS })[0];
      const id = feature?.properties?.id || null;
      if (id !== state.hovered) {
        if (state.hovered) setFeature(state.hovered, { hover: false });
        state.hovered = id;
        if (id) setFeature(id, { hover: true });
      }
      state.map.getCanvas().style.cursor = id ? 'pointer' : '';
      $('tooltip').hidden = !id;
      if (!id) return;
      $('tooltip').innerHTML = tooltipContents(id);
      const panel = $('map').getBoundingClientRect();
      $('tooltip').style.left = `${Math.min(event.point.x + 16, panel.width - 238)}px`;
      $('tooltip').style.top = `${Math.max(12, event.point.y - 26)}px`;
    });
    state.map.on('mouseleave', () => {
      if (state.hovered) setFeature(state.hovered, { hover: false });
      state.hovered = null;
      $('tooltip').hidden = true;
    });
    state.map.on('click', event => {
      const id = state.map.queryRenderedFeatures(event.point, { layers: LAYERS })[0]?.properties?.id || null;
      select(id);
    });
    new ResizeObserver(() => state.map.resize()).observe($('map'));
    window.addEventListener('resize', () => { state.map.resize(); fitMap(); });
  });
}

async function main() {
  try {
    const [geo, elections, polls] = await Promise.all(['boroughs.geojson', 'elections.json', 'polls.json']
      .map(file => fetch(`data/${file}`, { cache: 'no-store' }).then(response => {
        if (!response.ok) throw new Error(`${file}: HTTP ${response.status}`);
        return response.json();
      })));
    Object.assign(state, { geo, elections, polls });
    prepareGeometry();
    renderYears();
    renderPolls();
    render();
    initMap();
    $('borough-table').addEventListener('click', event => {
      const row = event.target.closest('[data-id]');
      if (!row) return;
      select(row.dataset.id);
      $('state-details').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
    $('reset-map').addEventListener('click', fitMap);
  } catch (error) {
    console.error(error);
    $('data-status').textContent = 'Could not load the local data snapshot';
    $('state-details').innerHTML = `<p class="section-note">Could not load atlas data. Please serve this directory over HTTP.</p>`;
  }
}

main();
