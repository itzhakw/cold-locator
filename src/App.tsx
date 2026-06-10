import { useState, useCallback, useEffect } from "react";
import MapView from "./components/MapView";
import LocationPanel from "./components/LocationPanel";
import SettingsPanel from "./components/SettingsPanel";
import SavedMarkersPanel from "./components/SavedMarkersPanel";
import AddMarkerDialog from "./components/AddMarkerDialog";
import type { TempUnit } from "./lib/mapUtils";
import { geocodeCity } from "./lib/mapUtils";
import { fetchSingleWeather } from "./lib/weather";
import { parseUrlParams, hasLocationParams, type EmbedConfig } from "./lib/urlParams";

export type ViewMode = "now" | "forecast";
export type MapStyleMode = "standard" | "satellite";

export interface UserLocation {
  lat: number;
  lng: number;
  label: string;
}

export interface CustomMarker {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
}

const embedConfig: EmbedConfig = parseUrlParams();

export default function App() {
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [userTemp, setUserTemp] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>(embedConfig.mode || "now");
  const [mapStyle, setMapStyle] = useState<MapStyleMode>(() => {
    return (localStorage.getItem("mapStyle") as MapStyleMode) || "standard";
  });
  const [unit, setUnit] = useState<TempUnit>(() => {
    if (embedConfig.unit) return embedConfig.unit;
    return (localStorage.getItem("tempUnit") as TempUnit) || "C";
  });
  const [locationError, setLocationError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [embedLocationLoading, setEmbedLocationLoading] = useState(
    hasLocationParams(embedConfig)
  );
  const [savedMarkers, setSavedMarkers] = useState<CustomMarker[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("savedMarkers") || "[]");
    } catch {
      return [];
    }
  });
  const [showSavedMarkers, setShowSavedMarkers] = useState(false);
  const [mapFocus, setMapFocus] = useState<{ lat: number; lng: number; zoom?: number; timestamp: number } | null>(null);
  const [pendingMarkerCoords, setPendingMarkerCoords] = useState<{ lat: number; lng: number } | null>(null);

  const toggleSavedMarkers = useCallback(() => {
    setShowSavedMarkers((s) => !s);
    setShowSettings(false);
  }, []);

  const toggleSettings = useCallback(() => {
    setShowSettings((s) => {
      const next = !s;
      if (next) {
        (window as any).dataLayer = (window as any).dataLayer || [];
        (window as any).dataLayer.push({
          event: "open_settings",
        });
      }
      return next;
    });
    setShowSavedMarkers(false);
  }, []);

  const handleAddMarker = useCallback((marker: CustomMarker) => {
    setSavedMarkers((prev) => {
      const next = [...prev, marker];
      localStorage.setItem("savedMarkers", JSON.stringify(next));
      return next;
    });
  }, []);

  const handleDeleteMarker = useCallback((id: string) => {
    setSavedMarkers((prev) => {
      const next = prev.filter((m) => m.id !== id);
      localStorage.setItem("savedMarkers", JSON.stringify(next));
      return next;
    });
  }, []);

  const handleFocusMarker = useCallback((lat: number, lng: number) => {
    setMapFocus({ lat, lng, zoom: 12, timestamp: Date.now() });
  }, []);

  const handleMapLongClick = useCallback((lat: number, lng: number) => {
    setPendingMarkerCoords({ lat, lng });
  }, []);

  const handleUnitChange = useCallback((u: TempUnit) => {
    setUnit(u);
    localStorage.setItem("tempUnit", u);
    (window as any).dataLayer = (window as any).dataLayer || [];
    (window as any).dataLayer.push({
      event: "change_unit",
      unit: u
    });
  }, []);

  const handleMapStyleChange = useCallback((m: MapStyleMode) => {
    setMapStyle(m);
    localStorage.setItem("mapStyle", m);
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
          viewMode={viewMode}
          onViewModeChange={setViewMode}
        />
      )}

      {!embedConfig.embed && (
        <>
          <button
            id="saved-markers-btn"
            className={`saved-markers-btn ${showSavedMarkers ? "active" : ""}`}
            onClick={toggleSavedMarkers}
            aria-label="Open saved locations"
            title="Saved Locations"
          >
            📌
          </button>
          <button
            id="settings-btn"
            className={`settings-btn ${showSettings ? "active" : ""}`}
            onClick={toggleSettings}
            aria-label="Open settings"
            title="Settings"
          >
            ⚙️
          </button>
        </>
      )}

      {showSettings && (
        <SettingsPanel
          unit={unit}
          onUnitChange={handleUnitChange}
          onClose={() => setShowSettings(false)}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          mapStyle={mapStyle}
          onMapStyleChange={handleMapStyleChange}
        />
      )}

      {showSavedMarkers && (
        <SavedMarkersPanel
          savedMarkers={savedMarkers}
          onAddMarker={handleAddMarker}
          onDeleteMarker={handleDeleteMarker}
          onClose={() => setShowSavedMarkers(false)}
          onFocusMarker={handleFocusMarker}
        />
      )}

      {pendingMarkerCoords && (
        <AddMarkerDialog
          lat={pendingMarkerCoords.lat}
          lng={pendingMarkerCoords.lng}
          onSave={(name, address) => {
            handleAddMarker({
              id: Date.now().toString(),
              name,
              address,
              lat: pendingMarkerCoords.lat,
              lng: pendingMarkerCoords.lng,
            });
            setPendingMarkerCoords(null);
          }}
          onCancel={() => setPendingMarkerCoords(null)}
        />
      )}

      <MapView
        userLocation={userLocation}
        userTemp={userTemp}
        unit={unit}
        onUserTempUpdate={setUserTemp}
        initialZoom={embedConfig.zoom}
        viewMode={viewMode}
        mapStyle={mapStyle}
        savedMarkers={savedMarkers}
        mapFocus={mapFocus}
        onMapLongClick={handleMapLongClick}
      />
    </main>
  );
}
