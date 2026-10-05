import { readFile, writeFile } from 'node:fs/promises';

const root = new URL('../data/', import.meta.url);
const electionUrl = 'https://www.wahlen-berlin.de/wahlen/BE2026/Afspraes/agh/Datenexport_AGH2026_Zweitstimme_A_BE.csv';
const pollsUrl = 'https://api.dawum.de/newest_surveys.json';
const partyByColumn = {
  P01: 'CDU', P02: 'SPD', P03: 'Greens', P04: 'Die Linke', P05: 'AfD',
  P06: 'FDP', P07: 'Animal Protection', P08: 'Die PARTEI', P09: 'Volt', P24: 'BSW'
};
const pollParty = { 0: 'Other', 2: 'SPD', 3: 'FDP', 4: 'Greens', 5: 'Die Linke', 7: 'AfD', 23: 'BSW', 101: 'CDU' };

async function fetchText(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return response.text();
}

async function saveIfChanged(file, value) {
  const target = new URL(file, root);
  const next = `${JSON.stringify(value)}\n`;
  const previous = await readFile(target, 'utf8').catch(() => '');
  if (next === previous) return false;
  await writeFile(target, next);
  return true;
}

function parseElection(csv) {
  const [head, ...lines] = csv.replace(/^\uFEFF/, '').trim().split(/\r?\n/);
  const keys = head.split(';');
  const districts = {};
  for (const line of lines) {
    const values = line.split(';');
    const row = Object.fromEntries(keys.map((key, i) => [key, values[i]]));
    if (row.Gebietsart !== 'Bezirk') continue;
    const valid = Number(row.Gueltig);
    const voters = Number(row.Waehler);
    const selected = Object.fromEntries(Object.entries(partyByColumn).map(([column, party]) => [party, Number(row[column] || 0)]));
    selected.Other = valid - Object.values(selected).reduce((sum, n) => sum + n, 0);
    if (!(valid > 0 && voters >= valid && selected.Other >= 0)) throw new Error(`Invalid result for district ${row.Nummer}`);
    districts[row.Nummer] = { valid, voters, votes: Object.fromEntries(Object.entries(selected).filter(([, n]) => n > 0).sort(([a], [b]) => a.localeCompare(b, 'en'))) };
  }
  if (Object.keys(districts).length !== 12) throw new Error('Election export does not contain all 12 boroughs');
  const cityVotes = {};
  for (const result of Object.values(districts)) for (const [party, votes] of Object.entries(result.votes)) {
    cityVotes[party] = (cityVotes[party] || 0) + votes;
  }
  return {
    city: {
      valid: Object.values(districts).reduce((sum, row) => sum + row.valid, 0),
      voters: Object.values(districts).reduce((sum, row) => sum + row.voters, 0),
      votes: Object.fromEntries(Object.entries(cityVotes).sort(([a], [b]) => a.localeCompare(b, 'en')))
    },
    boroughs: Object.fromEntries(Object.entries(districts).sort(([a], [b]) => a.localeCompare(b)))
  };
}

function parsePolls(database) {
  const surveys = Object.entries(database.Surveys).filter(([, survey]) => String(survey.Parliament_ID) === '3')
    .map(([id, survey]) => ({
      id, date: survey.Date, institute: database.Institutes[survey.Institute_ID]?.Name || `Institute ${survey.Institute_ID}`,
      sample: Number(survey.Surveyed_Persons || 0),
      results: Object.fromEntries(Object.entries(survey.Results).filter(([party]) => party in pollParty)
        .map(([party, value]) => [pollParty[party], value]))
    }))
    .sort((a, b) => b.date.localeCompare(a.date) || Number(b.id) - Number(a.id));
  return { source: 'https://dawum.de/API/', license: 'ODbL', scope: 'Berlin-wide only', surveys };
}

const election = JSON.parse(await readFile(new URL('elections.json', root), 'utf8'));
const fresh = parseElection(await fetchText(electionUrl));
election['2026'] = { ...election['2026'], ...fresh };
const polls = parsePolls(JSON.parse(await fetchText(pollsUrl)));
const changes = [await saveIfChanged('elections.json', election), await saveIfChanged('polls.json', polls)];
console.log(changes.some(Boolean) ? 'Updated local data' : 'No data changes');
