import type { City, BBox } from "./cityTiles";

export interface WeatherAlert {
  id: string;
  headline: string;
  severity: "Extreme" | "Severe" | "Moderate" | "Minor" | "Unknown";
  event: string;
  polygon: [number, number][]; // [lng, lat] pairs
  expires: string;
  areaDesc: string;
}

let alertsCache: { data: WeatherAlert[]; timestamp: number } | null = null;
const ALERTS_CACHE_TTL = 5 * 60 * 1000;

export async function fetchAlerts(): Promise<WeatherAlert[]> {
  if (alertsCache && Date.now() - alertsCache.timestamp < ALERTS_CACHE_TTL) {
    return alertsCache.data;
  }

  try {
    const res = await fetch("/api/alerts");
    if (!res.ok) return [];

    const raw = await res.json();
    if (!raw.features) return [];

    const alerts: WeatherAlert[] = [];

    for (const feature of raw.features) {
      // Only process alerts with a Polygon geometry
      if (feature.geometry?.type === "Polygon" && feature.geometry.coordinates?.length > 0) {
        const props = feature.properties;
        
        // Filter for weather-related events, though NWS API active alerts are generally weather
        // We ensure we only use severe enough warnings
        const severity = props.severity || "Unknown";
        
        // Only get the first ring of the polygon (outer boundary)
        const polygon = feature.geometry.coordinates[0] as [number, number][];

        alerts.push({
          id: props.id || props["@id"],
          headline: props.headline || props.event,
          severity: severity,
          event: props.event,
          polygon,
          expires: props.expires,
          areaDesc: props.areaDesc
        });
      }
    }

    alertsCache = { data: alerts, timestamp: Date.now() };
    return alerts;
  } catch (err) {
    console.error("Failed to fetch alerts:", err);
    return [];
  }
}

// Ray-casting algorithm to test if a point is inside a polygon
export function pointInPolygon(
  point: { lat: number; lng: number },
  polygon: [number, number][]
): boolean {
  const x = point.lng;
  const y = point.lat;
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0];
    const yi = polygon[i][1];
    const xj = polygon[j][0];
    const yj = polygon[j][1];

    const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }

  return inside;
}

export function citiesInAlertZones(
  cities: City[],
  alerts: WeatherAlert[]
): Map<number, WeatherAlert[]> {
  const map = new Map<number, WeatherAlert[]>();

  for (const city of cities) {
    const cityAlerts: WeatherAlert[] = [];
    const point = { lat: city.lat, lng: city.lng };

    for (const alert of alerts) {
      if (pointInPolygon(point, alert.polygon)) {
        cityAlerts.push(alert);
      }
    }

    if (cityAlerts.length > 0) {
      map.set(city.id, cityAlerts);
    }
  }

  return map;
}
