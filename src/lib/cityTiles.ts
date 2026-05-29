export interface City {
  id: number;
  name: string;
  lat: number;
  lng: number;
  population: number;
  country: string;
}

export interface BBox {
  north: number;
  south: number;
  east: number;
  west: number;
}

export interface ZoomThreshold {
  maxMarkers: number;
  minPopulation: number;
}

const ZOOM_THRESHOLDS: ZoomThreshold[] = [
  { maxMarkers: 15, minPopulation: 5_000_000 },
  { maxMarkers: 15, minPopulation: 5_000_000 },
  { maxMarkers: 15, minPopulation: 5_000_000 },
  { maxMarkers: 15, minPopulation: 5_000_000 },
  { maxMarkers: 30, minPopulation: 1_000_000 },
  { maxMarkers: 40, minPopulation: 500_000 },
  { maxMarkers: 60, minPopulation: 200_000 },
  { maxMarkers: 80, minPopulation: 100_000 },
  { maxMarkers: 120, minPopulation: 50_000 },
  { maxMarkers: 120, minPopulation: 50_000 },
  { maxMarkers: 200, minPopulation: 10_000 },
  { maxMarkers: 300, minPopulation: 5_000 },
  { maxMarkers: 500, minPopulation: 1_000 },
];

const MAJOR_ZOOM_MAX = 9;
const TILE_CACHE_NAME = "city-tiles-v1";

export function getZoomThreshold(zoom: number): ZoomThreshold {
  const idx = Math.min(Math.floor(zoom), ZOOM_THRESHOLDS.length - 1);
  return ZOOM_THRESHOLDS[idx];
}

function resolveTier(zoom: number): { suffix: string; manifest: Set<string> } {
  const floor = Math.floor(zoom);
  if (floor <= MAJOR_ZOOM_MAX && manifestMajor && manifestMajor.size > 0) {
    return { suffix: "_major", manifest: manifestMajor };
  }
  return { suffix: "", manifest: manifestFull ?? new Set() };
}

function bboxToTileKeys(bbox: BBox): string[] {
  const colMin = Math.floor((bbox.west + 180) / 10);
  const colMax = Math.floor((bbox.east + 180) / 10);
  const rowMin = Math.floor((bbox.south + 90) / 10);
  const rowMax = Math.floor((bbox.north + 90) / 10);

  const keys: string[] = [];
  for (let col = Math.max(0, colMin); col <= Math.min(35, colMax); col++) {
    for (let row = Math.max(0, rowMin); row <= Math.min(17, rowMax); row++) {
      keys.push(`${col}_${row}`);
    }
  }
  return keys;
}

function expandBbox(bbox: BBox, degreePad: number): BBox {
  return {
    north: Math.min(90, bbox.north + degreePad),
    south: Math.max(-90, bbox.south - degreePad),
    east: Math.min(180, bbox.east + degreePad),
    west: Math.max(-180, bbox.west - degreePad),
  };
}

const memCache = new Map<string, City[]>();
const pendingFetches = new Map<string, Promise<City[]>>();
let globalCities: City[] = [];
let globalLoaded = false;

let manifestFull: Set<string> | null = null;
let manifestMajor: Set<string> | null = null;
let manifestPromise: Promise<void> | null = null;

let tilesCacheStorage: Cache | undefined;

async function getTilesCache(): Promise<Cache | undefined> {
  if (tilesCacheStorage !== undefined) return tilesCacheStorage;
  if (typeof caches === "undefined") return undefined;
  tilesCacheStorage = await caches.open(TILE_CACHE_NAME).catch(() => undefined);
  return tilesCacheStorage;
}

async function cachedFetch(url: string): Promise<Response> {
  const cache = await getTilesCache();
  if (cache) {
    const hit = await cache.match(url);
    if (hit) return hit;
  }
  const response = await fetch(url);
  if (response.ok && cache) {
    cache.put(url, response.clone());
  }
  return response;
}

export async function loadManifests(): Promise<void> {
  if (manifestFull && manifestMajor) return;
  if (manifestPromise) return manifestPromise;
  manifestPromise = Promise.all([
    cachedFetch("/cities/manifest.json")
      .then((r) => r.json() as Promise<string[]>)
      .catch(() => [] as string[]),
    cachedFetch("/cities/manifest_major.json")
      .then((r) => r.json() as Promise<string[]>)
      .catch(() => [] as string[]),
  ]).then(([full, major]) => {
    manifestFull = new Set(full);
    manifestMajor = new Set(major);
  });
  return manifestPromise;
}

async function fetchGlobal(): Promise<City[]> {
  if (globalLoaded) return globalCities;
  const res = await cachedFetch("/cities/global.json");
  const data: City[] = await res.json();
  globalCities = data;
  globalLoaded = true;
  return data;
}

async function fetchTile(key: string, suffix: string): Promise<City[]> {
  const cacheKey = `${key}${suffix}`;
  if (memCache.has(cacheKey)) return memCache.get(cacheKey)!;
  if (pendingFetches.has(cacheKey)) return pendingFetches.get(cacheKey)!;

  const promise = cachedFetch(`/cities/${key}${suffix}.json`)
    .then((res) => {
      if (!res.ok) return [] as City[];
      return res.json() as Promise<City[]>;
    })
    .then((data) => {
      memCache.set(cacheKey, data);
      pendingFetches.delete(cacheKey);
      return data;
    })
    .catch(() => {
      pendingFetches.delete(cacheKey);
      return [] as City[];
    });

  pendingFetches.set(cacheKey, promise);
  return promise;
}

export async function getCitiesInView(
  bbox: BBox,
  zoom: number
): Promise<City[]> {
  const { maxMarkers, minPopulation } = getZoomThreshold(zoom);
  const useGlobalOnly = zoom < 4;
  let cities: City[];

  if (useGlobalOnly) {
    cities = await fetchGlobal();
  } else {
    await loadManifests();
    const { suffix, manifest } = resolveTier(zoom);
    const keys = bboxToTileKeys(bbox).filter((k) => manifest.has(k));
    const tileResults = await Promise.all(keys.map((k) => fetchTile(k, suffix)));
    cities = tileResults.flat();
  }

  const inBbox = cities.filter(
    (c) =>
      c.lat >= bbox.south &&
      c.lat <= bbox.north &&
      c.lng >= bbox.west &&
      c.lng <= bbox.east &&
      c.population >= minPopulation
  );

  inBbox.sort((a, b) => b.population - a.population);
  return inBbox.slice(0, maxMarkers);
}

export function estimateBboxForZoom(
  center: { lat: number; lng: number },
  zoom: number
): BBox {
  const lngSpan = 360 / Math.pow(2, zoom);
  const latSpan = lngSpan * 0.6;
  return {
    north: Math.min(90, center.lat + latSpan / 2),
    south: Math.max(-90, center.lat - latSpan / 2),
    east: Math.min(180, center.lng + lngSpan / 2),
    west: Math.max(-180, center.lng - lngSpan / 2),
  };
}

export async function prefetchTilesForBbox(
  bbox: BBox,
  zoom: number
): Promise<void> {
  if (zoom < 4) {
    await fetchGlobal();
    return;
  }
  await loadManifests();
  const { suffix, manifest } = resolveTier(zoom);
  const keys = bboxToTileKeys(bbox).filter((k) => manifest.has(k));
  await Promise.all(keys.map((k) => fetchTile(k, suffix)));
}

export function prefetchAdjacentTiles(
  bbox: BBox,
  zoom: number
): void {
  if (zoom < 4) return;
  const padded = expandBbox(bbox, 10);
  loadManifests().then(() => {
    const { suffix, manifest } = resolveTier(zoom);
    const currentKeys = new Set(bboxToTileKeys(bbox));
    const bufferKeys = bboxToTileKeys(padded).filter(
      (k) => !currentKeys.has(k) && manifest.has(k)
    );
    bufferKeys.forEach((k) => fetchTile(k, suffix));
  });
}

export function prefetchZoomTransition(
  bbox: BBox,
  currentZoom: number
): void {
  if (currentZoom < MAJOR_ZOOM_MAX || currentZoom >= MAJOR_ZOOM_MAX + 1) return;
  loadManifests().then(() => {
    const fullManifest = manifestFull ?? new Set<string>();
    const keys = bboxToTileKeys(bbox).filter((k) => fullManifest.has(k));
    keys.forEach((k) => fetchTile(k, ""));
  });
}

const ESCALATION_TILE_CAP = 20;

function filterCitiesInBbox(cities: City[], bbox: BBox, cap: number): City[] {
  return cities
    .filter(
      (c) =>
        c.lat >= bbox.south &&
        c.lat <= bbox.north &&
        c.lng >= bbox.west &&
        c.lng <= bbox.east
    )
    .sort((a, b) => b.population - a.population)
    .slice(0, cap);
}

async function fetchTierCities(
  bbox: BBox,
  suffix: string,
  manifest: Set<string> | null,
  cap: number
): Promise<City[]> {
  if (!manifest || manifest.size === 0) return [];
  await loadManifests();
  const keys = bboxToTileKeys(bbox)
    .filter((k) => manifest.has(k))
    .slice(0, ESCALATION_TILE_CAP);
  if (keys.length === 0) return [];
  const tiles = await Promise.all(keys.map((k) => fetchTile(k, suffix)));
  return filterCitiesInBbox(tiles.flat(), bbox, cap);
}

export async function getCitiesInViewEscalated(
  bbox: BBox,
  zoom: number,
  maxMarkersCap: number
): Promise<{ cities: City[]; escalated: boolean }> {
  const normal = await getCitiesInView(bbox, zoom);
  if (normal.length > 0) return { cities: normal, escalated: false };

  await loadManifests();
  const floorZoom = Math.floor(zoom);

  if (floorZoom < 4) {
    const majorCities = await fetchTierCities(
      bbox, "_major", manifestMajor, maxMarkersCap
    );
    if (majorCities.length > 0) return { cities: majorCities, escalated: true };

    const fullCities = await fetchTierCities(
      bbox, "", manifestFull, maxMarkersCap
    );
    if (fullCities.length > 0) return { cities: fullCities, escalated: true };
  }

  if (floorZoom >= 4 && floorZoom <= MAJOR_ZOOM_MAX) {
    const fullCities = await fetchTierCities(
      bbox, "", manifestFull, maxMarkersCap
    );
    if (fullCities.length > 0) return { cities: fullCities, escalated: true };
  }

  if (floorZoom >= 10) {
    const { suffix, manifest } = resolveTier(zoom);
    const keys = bboxToTileKeys(bbox)
      .filter((k) => manifest.has(k))
      .slice(0, ESCALATION_TILE_CAP);
    const tiles = await Promise.all(keys.map((k) => fetchTile(k, suffix)));
    const relaxed = filterCitiesInBbox(tiles.flat(), bbox, maxMarkersCap);
    if (relaxed.length > 0) return { cities: relaxed, escalated: true };
  }

  return { cities: [], escalated: false };
}

