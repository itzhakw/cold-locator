# Cold Locator — AGENTS.md

## Project Overview
An interactive temperature map showing places colder than the user's current location. Pure client-side React SPA deployed on Cloudflare Workers + Static Assets.

## Architecture

### City Data Pipeline (Tiled)
- **Source**: GeoNames `cities1000` dataset (~145K cities with pop > 1,000)
- **Build**: `npm run build:cities` → runs `scripts/build-cities.ts`
- **Two-tier output** (10°×10° geographic tile grid, 36×18 cells):
  - `{col}_{row}.json` — full tier, all cities (pop ≥ 1K), used at zoom ≥ 10
  - `{col}_{row}_major.json` — major tier (pop ≥ 50K only), used at zoom 4–9
- **Tile naming**: `col = floor((lng+180)/10)`, `row = floor((lat+90)/10)`
- **Global file**: `public/cities/global.json` — top 600 cities by population (always loaded)
- **Manifests**: `manifest.json` (full tile keys) + `manifest_major.json` (major tile keys)

### City Tile Loading (Client)
- At zoom < 4: only `global.json` is used
- At zoom 4–9: major tier tiles (`_major.json`) — ~50–100x smaller than full tiles
- At zoom ≥ 10: full tiles (all cities ≥ 1K pop)
- **Two-layer cache**: in-memory `Map<cacheKey, City[]>` + browser Cache API (`city-tiles-v1`) for cross-session persistence
- **Adjacent buffer prefetch**: after rendering, prefetch tiles 1 step out in all directions
- **Zoom boundary prefetch**: at zoom ~9.x, preload full tiles before the major→full transition at zoom 10

### Weather Data
- **API**: Open-Meteo (`api.open-meteo.com/v1/forecast`) — no API key required
- **Batch requests**: all visible cities in a single URL (comma-separated lat/lng, max 1000)
- **Cache**: in-memory `Map<cityKey, WeatherData>` with 30-minute TTL
- **Debounce**: 300ms after last map move event before fetching
- **FlyTo prefetch**: user weather + destination tiles + city weather all fetched in parallel during the 1800ms flyTo animation

### Zoom-based Population Filtering
See `src/lib/cityTiles.ts` `ZOOM_THRESHOLDS` array. Higher zoom = lower min population = smaller cities visible.

### Temperature Delta Logic
A city is shown only if `cityTemp < userTemp`. Delta = `cityTemp - userTemp` (always negative for shown cities). Color-coded by delta magnitude.

### Adaptive Cold Discovery (Tier Escalation)
When the normal zoom-based pass finds zero cold cities, the system cascades through deeper data tiers without changing the user's zoom:
- Zoom < 4 (global only) → try major tiles → if still nothing, try full tiles
- Zoom 4–9 (major tiles) → try full tiles
- Zoom ≥ 10 (full tiles) → relax minPopulation to 1K floor

Per-step caps: max 20 tiles fetched, max 50 cities returned. Cascade is uncapped — keeps going until cold results found or all tiers exhausted. Implemented in `getCitiesInViewEscalated()` in `cityTiles.ts`.

### Map
- **Library**: MapLibre GL JS v4 (GPU vector tiles)
- **Tiles**: OpenFreeMap Liberty style
- **Markers**: Custom HTML `DivMarker` elements, React renders HTML string → injected into MapLibre `Marker`

## Key Files
- `src/lib/cityTiles.ts` — tile math, fetch, cache, filter
- `src/lib/weather.ts` — Open-Meteo client
- `src/lib/weatherCodes.ts` — WMO code 0-99 decoder
- `src/lib/mapUtils.ts` — temp formatting, colors, debounce, geocoding
- `src/components/MapView.tsx` — map init, event wiring, marker orchestration
- `src/components/CityMarker.tsx` — marker HTML renderer
- `src/components/UserPin.tsx` — user location pin HTML renderer
- `scripts/build-cities.ts` — one-time data build script

## Commands
```bash
npm install          # Install deps
npm run build:cities # Download + process GeoNames data (run once, requires adm-zip)
npm run dev          # Vite dev server
npm run build        # Production build
npx wrangler dev     # Local Cloudflare preview
```

## Notes
- `adm-zip` is a dev-only dependency needed only for `build:cities` script
- MapLibre CSS is imported in `src/index.css` from the package
- Temperature unit preference stored in `localStorage` key `tempUnit`
- Open-Meteo is free for non-commercial use only
- OpenFreeMap tiles: no API key, no rate limit, CC-BY via OSM
