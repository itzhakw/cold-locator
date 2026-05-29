import type { TempUnit } from "./mapUtils";

export interface EmbedConfig {
  lat?: number;
  lng?: number;
  city?: string;
  zoom?: number;
  unit?: TempUnit;
  embed: boolean;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function parseUrlParams(): EmbedConfig {
  const params = new URLSearchParams(window.location.search);

  const rawLat = params.get("lat");
  const rawLng = params.get("lng");
  const rawCity = params.get("city");
  const rawZoom = params.get("zoom");
  const rawUnit = params.get("unit");
  const rawEmbed = params.get("embed");

  const lat = rawLat ? clamp(parseFloat(rawLat), -90, 90) : undefined;
  const lng = rawLng ? clamp(parseFloat(rawLng), -180, 180) : undefined;

  const validLat = lat !== undefined && !isNaN(lat);
  const validLng = lng !== undefined && !isNaN(lng);

  const zoom = rawZoom ? clamp(parseInt(rawZoom, 10), 1, 18) : undefined;
  const validZoom = zoom !== undefined && !isNaN(zoom);

  const unit: TempUnit | undefined =
    rawUnit === "F" ? "F" : rawUnit === "C" ? "C" : undefined;

  const city = rawCity?.trim() || undefined;

  return {
    lat: validLat ? lat : undefined,
    lng: validLng ? lng : undefined,
    city,
    zoom: validZoom ? zoom : undefined,
    unit,
    embed: rawEmbed === "1",
  };
}

export function hasLocationParams(config: EmbedConfig): boolean {
  return (config.lat !== undefined && config.lng !== undefined) || config.city !== undefined;
}
