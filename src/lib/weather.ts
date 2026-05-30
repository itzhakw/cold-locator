export interface WeatherData {
  temperature: number;
  weatherCode: number;
  rain: number;
  snowfall: number;
  fetchedAt: number;
}

export interface ForecastWeatherData {
  temperatureMax: number;
  temperatureMin: number;
  weatherCode: number;
  precipitationSum: number;
  snowfallSum: number;
  fetchedAt: number;
  forecastDay: number;
}

interface OpenMeteoCurrentResponse {
  current: {
    temperature_2m: number;
    weather_code: number;
    rain: number;
    snowfall: number;
  };
}

interface OpenMeteoDailyResponse {
  daily: {
    time: string[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    weather_code: number[];
    precipitation_sum: number[];
    snowfall_sum: number[];
  };
}

interface OpenMeteoBatchResponse {
  [key: string]: OpenMeteoCurrentResponse;
}

interface OpenMeteoBatchDailyResponse {
  [key: string]: OpenMeteoDailyResponse;
}

const CACHE_TTL_MS = 30 * 60 * 1000;
const FORECAST_CACHE_TTL_MS = 2 * 60 * 60 * 1000;
const weatherCache = new Map<string, WeatherData>();
const forecastCache = new Map<string, ForecastWeatherData>();

function makeCacheKey(lat: number, lng: number): string {
  return `${lat.toFixed(2)},${lng.toFixed(2)}`;
}

function makeForecastCacheKey(lat: number, lng: number, offset: number): string {
  return `${lat.toFixed(2)},${lng.toFixed(2)}:f${offset}`;
}

function isFresh(data: { fetchedAt: number }, ttl: number = CACHE_TTL_MS): boolean {
  return Date.now() - data.fetchedAt < ttl;
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

export async function fetchForecastBatch(
  locations: Array<{ id: number; lat: number; lng: number }>,
  dayOffset: number
): Promise<Map<number, ForecastWeatherData>> {
  const result = new Map<number, ForecastWeatherData>();
  const toFetch: typeof locations = [];

  for (const loc of locations) {
    const key = makeForecastCacheKey(loc.lat, loc.lng, dayOffset);
    const cached = forecastCache.get(key);
    if (cached && isFresh(cached, FORECAST_CACHE_TTL_MS)) {
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
  url.searchParams.set("daily", "temperature_2m_max,temperature_2m_min,weather_code,precipitation_sum,snowfall_sum");
  url.searchParams.set("forecast_days", (dayOffset + 1).toString());
  url.searchParams.set("timezone", "auto");

  const res = await fetch(url.toString());
  if (!res.ok) return result;

  const raw = await res.json();
  const responses: OpenMeteoDailyResponse[] = Array.isArray(raw) ? raw : [raw as OpenMeteoDailyResponse];

  for (let i = 0; i < toFetch.length; i++) {
    const loc = toFetch[i];
    const entry = responses[i] as OpenMeteoBatchDailyResponse | OpenMeteoDailyResponse;

    const daily = (entry as OpenMeteoDailyResponse).daily;
    if (!daily || !daily.time || daily.time.length <= dayOffset) continue;

    const data: ForecastWeatherData = {
      temperatureMax: daily.temperature_2m_max[dayOffset],
      temperatureMin: daily.temperature_2m_min[dayOffset],
      weatherCode: daily.weather_code[dayOffset],
      precipitationSum: daily.precipitation_sum[dayOffset],
      snowfallSum: daily.snowfall_sum[dayOffset],
      fetchedAt: Date.now(),
      forecastDay: dayOffset,
    };

    forecastCache.set(makeForecastCacheKey(loc.lat, loc.lng, dayOffset), data);
    result.set(loc.id, data);
  }

  return result;
}

export async function fetchSingleForecast(
  lat: number,
  lng: number,
  dayOffset: number
): Promise<ForecastWeatherData | null> {
  const key = makeForecastCacheKey(lat, lng, dayOffset);
  const cached = forecastCache.get(key);
  if (cached && isFresh(cached, FORECAST_CACHE_TTL_MS)) return cached;

  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", lat.toFixed(4));
  url.searchParams.set("longitude", lng.toFixed(4));
  url.searchParams.set("daily", "temperature_2m_max,temperature_2m_min,weather_code,precipitation_sum,snowfall_sum");
  url.searchParams.set("forecast_days", (dayOffset + 1).toString());
  url.searchParams.set("timezone", "auto");

  const res = await fetch(url.toString());
  if (!res.ok) return null;

  const raw = (await res.json()) as OpenMeteoDailyResponse;
  const daily = raw.daily;
  if (!daily || !daily.time || daily.time.length <= dayOffset) return null;

  const data: ForecastWeatherData = {
    temperatureMax: daily.temperature_2m_max[dayOffset],
    temperatureMin: daily.temperature_2m_min[dayOffset],
    weatherCode: daily.weather_code[dayOffset],
    precipitationSum: daily.precipitation_sum[dayOffset],
    snowfallSum: daily.snowfall_sum[dayOffset],
    fetchedAt: Date.now(),
    forecastDay: dayOffset,
  };

  forecastCache.set(key, data);
  return data;
}
