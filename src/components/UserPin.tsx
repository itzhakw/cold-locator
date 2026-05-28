import type { TempUnit } from "../lib/mapUtils";
import { formatTemp } from "../lib/mapUtils";

export function renderUserPin(
  label: string,
  temp: number | null,
  unit: TempUnit
): string {
  const tempStr = temp !== null ? formatTemp(temp, unit) : "…";
  return `
    <div class="user-pin">
      <div class="user-pin-pulse"></div>
      <div class="user-pin-body">
        <div class="user-pin-icon">📍</div>
        <div class="user-pin-info">
          <div class="user-pin-label">You're here</div>
          <div class="user-pin-name">${label}</div>
          <div class="user-pin-temp">${tempStr}</div>
        </div>
      </div>
    </div>
  `;
}
