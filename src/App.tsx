import { useState, useCallback } from "react";
import MapView from "./components/MapView";
import LocationPanel from "./components/LocationPanel";
import SettingsPanel from "./components/SettingsPanel";
import type { TempUnit } from "./lib/mapUtils";

export interface UserLocation {
  lat: number;
  lng: number;
  label: string;
}

export default function App() {
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [userTemp, setUserTemp] = useState<number | null>(null);
  const [unit, setUnit] = useState<TempUnit>(() => {
    return (localStorage.getItem("tempUnit") as TempUnit) || "C";
  });
  const [locationError, setLocationError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  const handleUnitChange = useCallback((u: TempUnit) => {
    setUnit(u);
    localStorage.setItem("tempUnit", u);
  }, []);

  const handleLocationSet = useCallback(
    (loc: UserLocation, temp: number | null) => {
      setUserLocation(loc);
      setUserTemp(temp);
      setLocationError(null);
    },
    []
  );

  return (
    <div className="app-root">
      <LocationPanel
        userLocation={userLocation}
        userTemp={userTemp}
        unit={unit}
        error={locationError}
        onLocationSet={handleLocationSet}
        onError={setLocationError}
      />

      <button
        id="settings-btn"
        className="settings-btn"
        onClick={() => setShowSettings((s) => !s)}
        aria-label="Open settings"
        title="Settings"
      >
        ⚙️
      </button>

      {showSettings && (
        <SettingsPanel
          unit={unit}
          onUnitChange={handleUnitChange}
          onClose={() => setShowSettings(false)}
        />
      )}

      <MapView
        userLocation={userLocation}
        userTemp={userTemp}
        unit={unit}
        onUserTempUpdate={setUserTemp}
      />
    </div>
  );
}
