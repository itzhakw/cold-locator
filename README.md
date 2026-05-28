# 🌡️ Cold Locator

An interactive temperature map that finds places colder than where you are right now. Select your location, and the map instantly populates with cities that are currently colder — color-coded by how much colder they are.

## Features

- **Real-time weather data** — powered by [Open-Meteo](https://open-meteo.com) (free, no API key)
- **145K+ cities** — sourced from [GeoNames](https://geonames.org) (population > 1,000)
- **Smart tile system** — two-tier city data loads only what's needed for the current zoom level
- **Persistent caching** — city tiles cached in the browser across sessions (Cache API)
- **Predictive prefetch** — adjacent tiles and zoom transitions pre-loaded in the background
- **Temperature units** — toggle between °C and °F
- **GPU-rendered map** — [MapLibre GL JS](https://maplibre.org) with [OpenFreeMap](https://openfreemap.org) tiles

## How It Works

1. Allow location access or search for your city
2. The app fetches your current temperature
3. Cities colder than yours appear on the map as color-coded markers:
   - 🟡 **Gold** — 1–3°C colder
   - 🔵 **Cyan** — 3–8°C colder  
   - 🔵 **Blue** — 8–15°C colder
   - 🔵 **Deep blue** — 15°C+ colder
4. Zoom in to see smaller cities — zoom out for major cities only

## Quick Start

```bash
npm install
npm run build:cities   # download + process GeoNames data (one-time)
npm run dev            # start Vite dev server
```

## Deployment

Built for Cloudflare Workers + Static Assets:

```bash
npm run build          # production build
npx wrangler deploy    # deploy to Cloudflare
```

## Architecture

### Two-Tier City Data

City data is pre-processed into a 10°×10° geographic tile grid:

| Tier | Content | Used at | Typical size |
|------|---------|---------|--------------|
| `_major.json` | Cities with pop ≥ 50K | Zoom 4–9 | 5–25 KB |
| `.json` (full) | All cities with pop ≥ 1K | Zoom 10+ | 50–1,100 KB |
| `global.json` | Top 600 cities | Zoom 0–3 | 59 KB |

At zoom 7, a Europe viewport downloads **79 KB** of major-tier tiles instead of **2.4 MB** of full tiles.

### Caching Strategy

- **In-memory** — `Map<key, City[]>` for instant same-session reads
- **Cache API** — `city-tiles-v1` for cross-session persistence (city data is immutable)
- **Weather cache** — 30-minute TTL per coordinate (weather changes, cities don't)

### Prefetching

- **Adjacent buffer** — after rendering, tiles 1 step out in every direction are pre-loaded
- **Zoom boundary** — at zoom ~9.x, full tiles are pre-loaded before the tier transition at zoom 10
- **FlyTo** — destination tiles + weather fetched in parallel during the 1.8s map animation

## Tech Stack

- **React 18** + **TypeScript**
- **Vite 6** (build)
- **MapLibre GL JS 4** (map rendering)
- **OpenFreeMap** (map tiles, no API key)
- **Open-Meteo** (weather API, free tier)
- **Cloudflare Workers** (deployment)

## Data Sources

| Source | License | Used for |
|--------|---------|----------|
| [GeoNames](https://geonames.org) | CC-BY | City names, coordinates, population |
| [Open-Meteo](https://open-meteo.com) | Free (non-commercial) | Real-time weather data |
| [OpenFreeMap](https://openfreemap.org) | CC-BY (OSM) | Map vector tiles |
| [FlagCDN](https://flagcdn.com) | MIT | Country flag icons |

## License

MIT
