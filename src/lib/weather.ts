export interface WeatherData {
  temperature: number;
  weatherCode: number;
  rain: number;
  snowfall: number;
  fetchedAt: number;
}

interface OpenMeteoCurrentResponse {
  current: {
    temperature_2m: number;
    weather_code: number;
    rain: number;
    snowfall: number;
  };
}

interface OpenMeteoBatchResponse {
  [key: string]: OpenMeteoCurrentResponse;
}

const CACHE_TTL_MS = 30 * 60 * 1000;
const weatherCache = new Map<string, WeatherData>();

function makeCacheKey(lat: number, lng: number): string {
  return `${lat.toFixed(2)},${lng.toFixed(2)}`;
}

function isFresh(data: WeatherData): boolean {
  return Date.now() - data.fetchedAt < CACHE_TTL_MS;
}

export async function fetchWeatherBatch(
  locations: Array<{ id: number; lat: number; lng: number }>
): Promise<Map<number, WeatherData>> {
  const result = new Map<number, WeatherData>();
  const toFetch: typeof locations = [];

  for (const loc of locations) {
    const key = makeCacheKey(loc.lat, loc.lng);
    const cached = weatherCache.get(key);
    if (cached && isFresh(cached)) {
      result.set(loc.id, cached);
    } else {
      toFetch.push(loc);
    }
  }

  if (toFetch.length === 0) return result;

  const lats = toFetch.map((l) => l.lat.toFixed(4)).join(",");
  const lngs = toFetch.map((l) => l.lng.toFixed(4)).join(",");

  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", lats);
  url.searchParams.set("longitude", lngs);
  url.searchParams.set("current", "temperature_2m,weather_code,rain,snowfall");
  url.searchParams.set("forecast_days", "1");
  url.searchParams.set("wind_speed_unit", "ms");

  const res = await fetch(url.toString());
  if (!res.ok) return result;

  const raw = await res.json();

  const responses: OpenMeteoCurrentResponse[] = Array.isArray(raw) ? raw : [raw as OpenMeteoCurrentResponse];

  for (let i = 0; i < toFetch.length; i++) {
    const loc = toFetch[i];
    const entry = responses[i] as OpenMeteoBatchResponse | OpenMeteoCurrentResponse;

    const current = (entry as OpenMeteoCurrentResponse).current;
    if (!current) continue;

    const data: WeatherData = {
      temperature: current.temperature_2m,
      weatherCode: current.weather_code,
      rain: current.rain,
      snowfall: current.snowfall,
      fetchedAt: Date.now(),
    };

    weatherCache.set(makeCacheKey(loc.lat, loc.lng), data);
    result.set(loc.id, data);
  }

  return result;
}

export async function fetchSingleWeather(
  lat: number,
  lng: number
): Promise<WeatherData | null> {
  const key = makeCacheKey(lat, lng);
  const cached = weatherCache.get(key);
  if (cached && isFresh(cached)) return cached;

  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", lat.toFixed(4));
  url.searchParams.set("longitude", lng.toFixed(4));
  url.searchParams.set("current", "temperature_2m,weather_code,rain,snowfall");
  url.searchParams.set("forecast_days", "1");

  const res = await fetch(url.toString());
  if (!res.ok) return null;

  const raw = (await res.json()) as OpenMeteoCurrentResponse;
  const data: WeatherData = {
    temperature: raw.current.temperature_2m,
    weatherCode: raw.current.weather_code,
    rain: raw.current.rain,
    snowfall: raw.current.snowfall,
    fetchedAt: Date.now(),
  };

  weatherCache.set(key, data);
  return data;
}
