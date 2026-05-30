import type { TempUnit } from "../lib/mapUtils";
import type { ViewMode } from "../App";
import ApiStatus from "./ApiStatus";

interface Props {
  unit: TempUnit;
  onUnitChange: (u: TempUnit) => void;
  onClose: () => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
}

export default function SettingsPanel({ unit, onUnitChange, onClose, viewMode, onViewModeChange }: Props) {
  return (
    <div className="settings-overlay" onClick={onClose}>
      <div
        className="settings-panel glass"
        id="settings-panel"
        role="dialog"
        aria-labelledby="settings-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="settings-header">
          <h2 className="settings-title" id="settings-title">Settings</h2>
          <button className="settings-close" onClick={onClose} id="settings-close-btn" aria-label="Close settings">✕</button>
        </div>

        <div className="settings-section">
          <label className="settings-label">View Mode</label>
          <div className="mode-toggle" id="mode-toggle" style={{ padding: "4px", marginBottom: "16px", background: "rgba(255, 255, 255, 0.04)" }}>
            <button
              className={`mode-btn ${viewMode === "now" ? "active" : ""}`}
              id="mode-now"
              onClick={() => onViewModeChange("now")}
              style={{ flex: 1, padding: "8px", borderRadius: "10px", textAlign: "center" }}
            >
              Now
            </button>
            <button
              className={`mode-btn ${viewMode === "forecast" ? "active" : ""}`}
              id="mode-forecast"
              onClick={() => onViewModeChange("forecast")}
              style={{ flex: 1, padding: "8px", borderRadius: "10px", textAlign: "center" }}
            >
              7 Days
            </button>
          </div>
          
          <label className="settings-label">Temperature Unit</label>
          <div className="unit-toggle" id="unit-toggle">
            <button
              className={`unit-btn ${unit === "C" ? "active" : ""}`}
              id="unit-celsius"
              onClick={() => onUnitChange("C")}
            >
              °C Celsius
            </button>
            <button
              className={`unit-btn ${unit === "F" ? "active" : ""}`}
              id="unit-fahrenheit"
              onClick={() => onUnitChange("F")}
            >
              °F Fahrenheit
            </button>
          </div>
        </div>

        <div className="settings-section legend-section">
          <label className="settings-label">Cold Scale</label>
          <div className="legend">
            <div className="legend-item">
              <span className="legend-dot" style={{ background: "#ca8a04" }} />
              <span>0–3°C colder</span>
            </div>
            <div className="legend-item">
              <span className="legend-dot" style={{ background: "#0891b2" }} />
              <span>3–8°C colder</span>
            </div>
            <div className="legend-item">
              <span className="legend-dot" style={{ background: "#1565c0" }} />
              <span>8–15°C colder</span>
            </div>
            <div className="legend-item">
              <span className="legend-dot" style={{ background: "#1a237e" }} />
              <span>15°C+ colder</span>
            </div>
          </div>
        </div>

        <div className="settings-section legend-section">
          <label className="settings-label">Icons Legend</label>
          <div className="legend">
            <div className="legend-item">
              <span className="legend-icon" style={{ fontSize: "1rem", background: "rgba(0,0,0,0.6)", padding: "2px 6px", borderRadius: "10px", marginRight: "6px" }}>☁️</span>
              <span>Fog / Clouds</span>
            </div>
            <div className="legend-item">
              <span className="legend-icon" style={{ fontSize: "1rem", background: "rgba(0,0,0,0.6)", padding: "2px 6px", borderRadius: "10px", marginRight: "6px" }}>🌧️</span>
              <span>Rain / Showers</span>
            </div>
            <div className="legend-item">
              <span className="legend-icon" style={{ fontSize: "1rem", background: "rgba(0,0,0,0.6)", padding: "2px 6px", borderRadius: "10px", marginRight: "6px" }}>❄️</span>
              <span>Snow</span>
            </div>
            <div className="legend-item">
              <span className="legend-icon" style={{ fontSize: "1rem", background: "rgba(0,0,0,0.6)", padding: "2px 6px", borderRadius: "10px", marginRight: "6px" }}>⛈️</span>
              <span>Thunderstorm</span>
            </div>
            <div className="legend-item" style={{ marginTop: "6px" }}>
              <span style={{ fontSize: "0.85rem", background: "rgba(239, 68, 68, 0.9)", color: "white", borderRadius: "50%", width: "20px", height: "20px", display: "inline-flex", alignItems: "center", justifyContent: "center", marginRight: "6px", flexShrink: 0 }}>⚠️</span>
              <span>Active NWS Alert (US)</span>
            </div>
            <div className="legend-item">
              <span style={{ fontSize: "0.85rem", marginRight: "6px", display: "inline-flex", width: "20px", justifyContent: "center" }}>⚠️</span>
              <span>Severe Weather (Forecast)</span>
            </div>
          </div>
        </div>

        <ApiStatus />

        <div className="settings-footer">
          <p>Data: <a href="https://open-meteo.com" target="_blank" rel="noopener">Open-Meteo</a></p>
          <p>Maps: <a href="https://openfreemap.org" target="_blank" rel="noopener">OpenFreeMap</a></p>
          <p>Cities: <a href="https://geonames.org" target="_blank" rel="noopener">GeoNames</a> (CC-BY)</p>
        </div>
      </div>
    </div>
  );
}
