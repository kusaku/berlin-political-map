# Political Atlas — Berlin

A single-page, static 3D map of Berlin's twelve boroughs. The map shows Abgeordnetenhaus party-list second-vote results for 2011, 2016, 2021, 2023 and 2026. The 2021 election was annulled and is labelled historical; 2026 is currently provisional. Citywide opinion polls are displayed separately from borough election results.

## Run locally

Serve the directory over HTTP, for example with `python3 -m http.server 8769`, then open `http://127.0.0.1:8769/`. All election, geometry and poll data are read from local JSON files. MapLibre and Turf are loaded from their CDN; no build step or backend is required. GitHub Pages can serve the repository root directly.

## Data and sources

- **2026:** [Berlin election authority's CSV export](https://www.wahlen-berlin.de/wahlen/BE2026/Afspraes/agh/downloads.html), borough totals of party-list second votes.
- **2023:** [Official final Excel precinct export](https://www.wahlen-berlin.de/wahlen/BE2023/AFSPRAES/agh/downloads.html), aggregated to boroughs.
- **2021:** [Official result report](https://www.berlin.de/wahlen/historie/berliner-wahlen/ergebnisberichte/sb_b07-02-03_2021j05_be_ah_bvv-2.pdf); annulled and repeated in 2023.
- **2016:** [Official final Excel precinct export](https://www.wahlen-berlin.de/Wahlen/BE2016/afspraes/download/download.html), aggregated to boroughs.
- **2011:** [Official result report](https://www.berlin.de/wahlen/historie/berliner-wahlen/ergebnisberichte/sb_b7-2-3-j05-11_be.pdf), borough party-list votes.
- **Boundaries:** [Berlin ALKIS Bezirke WFS](https://daten.berlin.de/datensaetze/alkis-berlin-bezirke-wfs-ced31d7d), `dl-de/zero-2.0`.
- **Polling:** [DAWUM API](https://dawum.de/API/), Open Database License (ODbL), Berlin-wide only.
- **Flags:** Borough flags 01–10 from [Wikimedia Commons](https://commons.wikimedia.org/wiki/City_and_state_emblems_of_Berlin); Lichtenberg and Reinickendorf from [Flags of the World](https://www.crwflags.com/fotw/flags/de-be-.html). Flags are official emblems; two source images are GIF because the Commons download endpoint was rate-limited during import.

Election percentages are calculated as a party's votes divided by all valid party-list second votes. `Other` is the remainder after the named parties, never an inferred vote count. Pre-2001 borough boundaries were different; earlier years are not projected onto today's districts. No borough polling is inferred from citywide surveys.

## Updates

`node scripts/update-data.mjs` refreshes the 2026 election export and latest DAWUM Berlin polls. It validates all twelve boroughs and only rewrites local JSON when content changes. The included workflow runs daily at 00:00 UTC and commits only changed data. Historical years and the provisional/final designation require manual, source-verified maintenance.
