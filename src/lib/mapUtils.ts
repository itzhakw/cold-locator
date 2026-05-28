export type TempUnit = "C" | "F";

export function celsiusToFahrenheit(c: number): number {
  return (c * 9) / 5 + 32;
}

export function formatTemp(celsius: number, unit: TempUnit): string {
  if (unit === "F") return `${Math.round(celsiusToFahrenheit(celsius))}°F`;
  return `${Math.round(celsius)}°C`;
}

export function formatDelta(delta: number, unit: TempUnit): string {
  const value = unit === "F" ? Math.round((delta * 9) / 5) : Math.round(delta);
  const abs = Math.abs(value);
  const sign = delta < 0 ? "−" : "+";
  const unitStr = unit === "F" ? "°F" : "°C";
  return `${sign}${abs}${unitStr}`;
}

export function getColdColor(delta: number): string {
  if (delta <= -15) return "#1a237e";
  if (delta <= -8) return "#1565c0";
  if (delta <= -3) return "#0891b2";
  return "#ca8a04";
}

export function getColdGlow(delta: number): string {
  if (delta <= -15) return "rgba(26, 35, 126, 0.65)";
  if (delta <= -8) return "rgba(21, 101, 192, 0.55)";
  if (delta <= -3) return "rgba(8, 145, 178, 0.5)";
  return "rgba(202, 138, 4, 0.55)";
}

export function debounce<T extends (...args: Parameters<T>) => void>(
  fn: T,
  ms: number
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

export interface GeocodingResult {
  name: string;
  lat: number;
  lng: number;
  country: string;
  admin1?: string;
}

export async function geocodeCity(query: string): Promise<GeocodingResult[]> {
  const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
  url.searchParams.set("name", query);
  url.searchParams.set("count", "5");
  url.searchParams.set("language", "en");
  url.searchParams.set("format", "json");

  const res = await fetch(url.toString());
  if (!res.ok) return [];

  const data = await res.json() as { results?: Array<{
    name: string;
    latitude: number;
    longitude: number;
    country: string;
    admin1?: string;
  }> };

  if (!data.results) return [];
  return data.results.map((r) => ({
    name: r.name,
    lat: r.latitude,
    lng: r.longitude,
    country: r.country,
    admin1: r.admin1,
  }));
}
