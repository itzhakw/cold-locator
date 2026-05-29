import { useState, useCallback, useEffect } from "react";
import MapView from "./components/MapView";
import LocationPanel from "./components/LocationPanel";
import SettingsPanel from "./components/SettingsPanel";
import type { TempUnit } from "./lib/mapUtils";
import { geocodeCity } from "./lib/mapUtils";
import { fetchSingleWeather } from "./lib/weather";
import { parseUrlParams, hasLocationParams, type EmbedConfig } from "./lib/urlParams";

export interface UserLocation {
  lat: number;
  lng: number;
  label: string;
}

const embedConfig: EmbedConfig = parseUrlParams();

export default function App() {
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [userTemp, setUserTemp] = useState<number | null>(null);
  const [unit, setUnit] = useState<TempUnit>(() => {
    if (embedConfig.unit) return embedConfig.unit;
    return (localStorage.getItem("tempUnit") as TempUnit) || "C";
  });
  const [locationError, setLocationError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [embedLocationLoading, setEmbedLocationLoading] = useState(
    hasLocationParams(embedConfig)
  );

  const handleUnitChange = useCallback((u: TempUnit) => {
    setUnit(u);
    localStorage.setItem("tempUnit", u);
    (window as any).dataLayer = (window as any).dataLayer || [];
    (window as any).dataLayer.push({
      event: "change_unit",
      unit: u
    });
  }, []);

  const handleLocationSet = useCallback(
    (loc: UserLocation, temp: number | null) => {
      setUserLocation(loc);
      setUserTemp(temp);
      setLocationError(null);
    },
    []
  );

  useEffect(() => {
    if (!hasLocationParams(embedConfig)) return;

    const resolveEmbedLocation = async () => {
      let lat = embedConfig.lat;
      let lng = embedConfig.lng;
      let label = "Selected location";

      if (lat !== undefined && lng !== undefined) {
        label = `${lat.toFixed(2)}, ${lng.toFixed(2)}`;
      } else if (embedConfig.city) {
        const results = await geocodeCity(embedConfig.city);
        if (results.length > 0) {
          const best = results[0];
          lat = best.lat;
          lng = best.lng;
          label = best.admin1
            ? `${best.name}, ${best.admin1}`
            : `${best.name}, ${best.country}`;
        }
      }

      if (lat === undefined || lng === undefined) {
        setEmbedLocationLoading(false);
        return;
      }

      const weather = await fetchSingleWeather(lat, lng);
      handleLocationSet(
        { lat, lng, label },
        weather?.temperature ?? null
      );
      setEmbedLocationLoading(false);
    };

    resolveEmbedLocation();
  }, [handleLocationSet]);

  return (
    <main className="app-root">
      <a href="#map" className="sr-only">Skip to map</a>

      {!embedLocationLoading && (
        <LocationPanel
          userLocation={userLocation}
          userTemp={userTemp}
          unit={unit}
          error={locationError}
          onLocationSet={handleLocationSet}
          onError={setLocationError}
          embed={embedConfig.embed}
        />
      )}

      {!embedConfig.embed && (
        <button
          id="settings-btn"
          className="settings-btn"
          onClick={() => {
            setShowSettings((s) => {
              const next = !s;
              if (next) {
                (window as any).dataLayer = (window as any).dataLayer || [];
                (window as any).dataLayer.push({
                  event: "open_settings"
                });
              }
              return next;
            });
          }}
          aria-label="Open settings"
          title="Settings"
        >
          ⚙️
        </button>
      )}

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
        initialZoom={embedConfig.zoom}
      />
    </main>
  );
}
