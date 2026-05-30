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

### Forecast & Alert Modes
- **Now Mode**: Compares current temperature between user and cities.
- **7-Day Mode**: Fetches 7-day forecast (`temperature_2m_max`) from Open-Meteo. 
  - Cities colder than the user's forecast max get a blue marker.
  - Cities with severe weather forecast (`weather_code >= 51`) get an orange/red gradient marker (if not colder) or a storm badge (if colder).
- **Regional Alerts**: Uses NWS active alerts as an invisible spatial index. 
  - Proxied through Cloudflare Worker `/api/alerts` to bypass CORS.
  - Client performs ray-casting point-in-polygon tests to find cities inside alert zones.
  - Cities inside alert zones get a pulsing `⚠️` badge.
  - The API health panel in settings queries `/api/health` to monitor upstream connectivity.

## Key Files
- `src/lib/cityTiles.ts` — tile math, fetch, cache, filter
- `src/lib/weather.ts` — Open-Meteo client (current & forecast)
- `src/lib/alerts.ts` — NWS alert fetcher and point-in-polygon logic
- `src/lib/weatherCodes.ts` — WMO code 0-99 decoder
- `src/lib/mapUtils.ts` — temp formatting, colors, debounce, geocoding
- `src/components/MapView.tsx` — map init, event wiring, dual-mode orchestration
- `src/components/CityMarker.tsx` — marker HTML renderer (current & forecast variants)
- `src/components/UserPin.tsx` — user location pin HTML renderer
- `src/components/ApiStatus.tsx` — settings panel API health monitor
- `src/worker.ts` — Cloudflare worker (SPA routing + `/api/alerts`, `/api/health` proxies)
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
- On mobile viewports (≤ 480px) in standard mode, the located panel width is set to `calc(100% - 80px)` and offset to the left (`left: 12px; transform: none`) to prevent the settings button from overlapping the "Change" button. It remains full width in embed mode.

## SEO & AIO
- **Structured data**: Three JSON-LD blocks in `index.html` — `WebApplication`, `FAQPage`, `HowTo`
- **Open Graph + Twitter Cards**: Meta tags for social sharing with branded OG image (`public/og-image.jpg`)
- **Canonical URL**: `https://colder.itiszack.com/`
- **robots.txt + sitemap.xml**: Static files in `public/`
- **llms.txt**: AI agent integration guide at `public/llms.txt`, linked via `<link rel="llms">` in `<head>`
- **noscript fallback**: Crawlable text content (description, how-it-works, features) rendered for JS-disabled crawlers
- **No visible UI changes**: All SEO content is invisible to regular users

## Embed API (AI Agent Integration)
The app supports URL query parameters for deep-linking and iframe embedding.

### URL Parameters
| Parameter | Type     | Default | Description                                      |
|-----------|----------|---------|--------------------------------------------------|
| `lat`     | number   | —       | Latitude (-90 to 90)                             |
| `lng`     | number   | —       | Longitude (-180 to 180)                          |
| `city`    | string   | —       | City name, optionally with country: "London,UK"  |
| `zoom`    | number   | 7       | Map zoom level (1–18)                            |
| `unit`    | C or F   | C       | Temperature unit                                 |
| `embed`   | 1        | —       | Minimal embed UI (hides settings button)         |

### Embed Behavior
- `embed=1`: Hides settings button, shows "Open ↗" link instead of "Change" button in located panel
- `city` parameter: Geocoded via Open-Meteo Geocoding API on load, supports "City,Country" format
- `lat`+`lng`: Direct coordinate positioning, skips geocoding
- No `X-Frame-Options` header — any domain can iframe the app

### Key Files
- `src/lib/urlParams.ts` — URL parameter parser and validator
- `public/llms.txt` — AI agent integration documentation

## Analytics & Tracking
The application uses Google Tag Manager (GTM) and Google Analytics 4 (GA4) for event tracking. 
The GTM container ID is `GTM-PKRQDFG2`.

### Implemented Custom Events
Events are pushed to the `dataLayer` via the `window.dataLayer` object.
1. **`detect_location`**: Fired when the user clicks the "Use my location" button.
   - Parameters: `status` ('success' | 'error'), `location_label` (string, e.g., "New York, US"), `error_message` (string, if applicable)
2. **`select_city`**: Fired when the user selects a city from the search dropdown.
   - Parameters: `city_name`, `country`
3. **`open_settings`**: Fired when the user toggles the settings panel open.
4. **`change_unit`**: Fired when the user changes the temperature unit preference.
   - Parameters: `unit` ('C' | 'F')
5. **`click_cold_city`**: Fired when the user clicks on a cold destination city marker on the map.
   - Parameters: `city_id`, `city_name`, `country`, `temperature`, `delta`

### GTM Configuration
- The workspace includes Data Layer Variables for all the parameters listed above.
- Triggers are set up for each custom event name.
- GA4 Event Tags are configured to pass these parameters to the connected GA4 Measurement ID.
