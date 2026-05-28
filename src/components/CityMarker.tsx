import type { City } from "../lib/cityTiles";
import type { WeatherData } from "../lib/weather";
import type { TempUnit } from "../lib/mapUtils";
import { getColdColor, getColdGlow, formatTemp, formatDelta } from "../lib/mapUtils";
import { getWeatherIcons } from "../lib/weatherCodes";

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
