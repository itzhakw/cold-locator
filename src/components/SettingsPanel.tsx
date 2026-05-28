import type { TempUnit } from "../lib/mapUtils";

interface Props {
  unit: TempUnit;
  onUnitChange: (u: TempUnit) => void;
  onClose: () => void;
}

export default function SettingsPanel({ unit, onUnitChange, onClose }: Props) {
  return (
    <div className="settings-overlay" onClick={onClose}>
      <div
        className="settings-panel glass"
        id="settings-panel"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="settings-header">
          <h2 className="settings-title">Settings</h2>
          <button className="settings-close" onClick={onClose} id="settings-close-btn" aria-label="Close settings">✕</button>
        </div>

        <div className="settings-section">
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

        <div className="settings-footer">
          <p>Data: <a href="https://open-meteo.com" target="_blank" rel="noopener">Open-Meteo</a></p>
          <p>Maps: <a href="https://openfreemap.org" target="_blank" rel="noopener">OpenFreeMap</a></p>
          <p>Cities: <a href="https://geonames.org" target="_blank" rel="noopener">GeoNames</a> (CC-BY)</p>
        </div>
      </div>
    </div>
  );
}
