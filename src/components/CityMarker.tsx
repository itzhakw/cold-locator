import type { City } from "../lib/cityTiles";
import type { WeatherData, ForecastWeatherData } from "../lib/weather";
import type { TempUnit } from "../lib/mapUtils";
import { getColdColor, getColdGlow, formatTemp, formatDelta } from "../lib/mapUtils";
import { getWeatherIcons } from "../lib/weatherCodes";
import type { WeatherAlert } from "../lib/alerts";

const FLAG_BASE = "https://flagcdn.com/16x12";

function countryFlag(code: string): string {
  const lower = code.toLowerCase();
  return `<img src="${FLAG_BASE}/${lower}.png" alt="${code}" width="16" height="12" style="border-radius:2px;vertical-align:middle;margin-right:4px;" loading="lazy" />`;
}

export function renderCityMarker(
  city: City,
  weather: WeatherData,
  delta: number,
  unit: TempUnit
): string {
  const color = getColdColor(delta);
  const glow = getColdGlow(delta);
  const textColor = delta > -3 ? "#1c1500" : "#ffffff";
  const icons = getWeatherIcons(weather.weatherCode);
  const iconsHtml = icons.length > 0
    ? `<div class="marker-icons">${icons.join(" ")}</div>`
    : "";

  const tempStr = formatTemp(weather.temperature, unit);
  const deltaStr = formatDelta(delta, unit);

  return `
    <div class="city-marker" style="--accent:${color};--glow:${glow};--marker-text:${textColor};" data-city-id="${city.id}">
      ${iconsHtml}
      <div class="marker-body">
        <div class="marker-name">
          ${countryFlag(city.country)}${city.name}
        </div>
        <div class="marker-temp">${tempStr}</div>
        <div class="marker-delta">${deltaStr} colder</div>
      </div>
    </div>
  `;
}

export function renderForecastMarker(
  city: City,
  forecast: ForecastWeatherData,
  delta: number,
  unit: TempUnit,
  hasStorm: boolean,
  alertCount: number
): string {
  // If it's not colder, we use an orange/red gradient for storm emphasis.
  // If it's both colder and stormy, we keep the cold color and rely on the badge.
  const isColder = delta < 0;
  
  const color = isColder ? getColdColor(delta) : "rgba(239, 68, 68, 0.9)";
  const glow = isColder ? getColdGlow(delta) : "rgba(239, 68, 68, 0.5)";
  const textColor = isColder ? (delta > -3 ? "#1c1500" : "#ffffff") : "#ffffff";
  
  const icons = getWeatherIcons(forecast.weatherCode);
  const iconsHtml = icons.length > 0
    ? `<div class="marker-icons">${icons.join(" ")}</div>`
    : "";

  const tempStr = formatTemp(forecast.temperatureMax, unit);
  const deltaStr = isColder ? `${formatDelta(delta, unit)} colder (7d)` : `(7d forecast)`;

  const dateStr = new Date(forecast.fetchedAt + forecast.forecastDay * 86400000).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

  const stormBadgeHtml = hasStorm ? `<div class="storm-badge" title="Severe Weather Forecast">⚠️</div>` : "";
  const alertBadgeHtml = alertCount > 0 ? `<div class="alert-badge" title="${alertCount} active NWS Alerts">⚠️</div>` : "";
  const extraClasses = !isColder && hasStorm ? " storm" : "";

  return `
    <div class="city-marker forecast-marker" style="--accent:${color};--glow:${glow};--marker-text:${textColor};" data-city-id="${city.id}">
      ${iconsHtml}
      <div class="marker-body${extraClasses}">
        ${alertBadgeHtml}
        ${stormBadgeHtml}
        <div class="marker-forecast-date">${dateStr}</div>
        <div class="marker-name">
          ${countryFlag(city.country)}${city.name}
        </div>
        <div class="marker-temp">${tempStr}</div>
        <div class="marker-delta">${deltaStr}</div>
      </div>
    </div>
  `;
}
