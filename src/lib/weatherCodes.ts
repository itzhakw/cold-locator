export type WeatherCondition = "clear" | "cloudy" | "fog" | "drizzle" | "rain" | "sleet" | "snow" | "storm";

export interface WeatherConditionInfo {
  condition: WeatherCondition;
  emoji: string;
  label: string;
}

export function decodeWeatherCode(code: number): WeatherConditionInfo {
  if (code === 0) return { condition: "clear", emoji: "☀️", label: "Clear" };
  if (code <= 3) return { condition: "cloudy", emoji: "⛅", label: "Cloudy" };
  if (code <= 48) return { condition: "fog", emoji: "☁️", label: "Fog" };
  if (code <= 57) return { condition: "drizzle", emoji: "🌦️", label: "Drizzle" };
  if (code <= 67) return { condition: "rain", emoji: "🌧️", label: "Rain" };
  if (code <= 69) return { condition: "sleet", emoji: "🌨️", label: "Sleet" };
  if (code <= 77) return { condition: "snow", emoji: "❄️", label: "Snow" };
  if (code <= 82) return { condition: "rain", emoji: "🌧️", label: "Showers" };
  if (code <= 86) return { condition: "snow", emoji: "❄️", label: "Snow showers" };
  if (code <= 99) return { condition: "storm", emoji: "⛈️", label: "Thunderstorm" };
  return { condition: "clear", emoji: "🌡️", label: "Unknown" };
}

export function getWeatherIcons(code: number): string[] {
  const icons: string[] = [];
  if (code >= 51 && code <= 82) icons.push("🌧️");
  if ((code >= 71 && code <= 77) || (code >= 85 && code <= 86)) icons.push("❄️");
  if (code >= 95) icons.push("⛈️");
  if (code === 45 || code === 48) icons.push("☁️");
  if (code === 68 || code === 69) icons.push("🌨️");
  return icons;
}

export function isNotableWeather(code: number): boolean {
  return code >= 45;
}
