import { useState, useEffect, useRef } from "react";
import type { UserLocation, ViewMode } from "../App";
import type { TempUnit } from "../lib/mapUtils";
import { formatTemp, geocodeCity, type GeocodingResult } from "../lib/mapUtils";
import { fetchSingleWeather, fetchSingleForecast } from "../lib/weather";

interface Props {
  userLocation: UserLocation | null;
  userTemp: number | null;
  unit: TempUnit;
  error: string | null;
  onLocationSet: (loc: UserLocation, temp: number | null) => void;
  onError: (err: string) => void;
  embed?: boolean;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
}

type PanelState = "requesting" | "search" | "located" | "loading";

export default function LocationPanel({
  userLocation,
  userTemp,
  unit,
  error,
  onLocationSet,
  onError,
  embed = false,
  viewMode,
  onViewModeChange,
}: Props) {
  const [state, setState] = useState<PanelState>("requesting");
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState<GeocodingResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listboxId = "city-suggestions";

  useEffect(() => {
    if (userLocation) {
      setState("located");
      return;
    }
    setState("requesting");
    if (!navigator.geolocation) {
      (window as any).dataLayer = (window as any).dataLayer || [];
      (window as any).dataLayer.push({
        event: "detect_location",
        status: "failed",
        error_message: "Geolocation not supported by your browser."
      });
      setState("search");
      onError("Geolocation not supported by your browser.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        setState("loading");
        const { latitude: lat, longitude: lng } = pos.coords;
        let temp: number | null = null;
        if (viewMode === "forecast") {
          const w = await fetchSingleForecast(lat, lng, 7);
          temp = w?.temperatureMax ?? null;
        } else {
          const w = await fetchSingleWeather(lat, lng);
          temp = w?.temperature ?? null;
        }
        
        (window as any).dataLayer = (window as any).dataLayer || [];
        (window as any).dataLayer.push({
          event: "detect_location",
          status: "success",
          location_label: "Your location"
        });
        onLocationSet(
          { lat, lng, label: "Your location" },
          temp
        );
        setState("located");
      },
      () => {
        (window as any).dataLayer = (window as any).dataLayer || [];
        (window as any).dataLayer.push({
          event: "detect_location",
          status: "failed",
          error_message: "Location access denied. Search for your city below."
        });
        setState("search");
        onError("Location access denied. Search for your city below.");
      },
      { timeout: 10000 }
    );
  }, []);

  const handleSearchInput = (q: string) => {
    setSearchQuery(q);
    setActiveIndex(-1);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.length < 2) { setSuggestions([]); return; }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      const results = await geocodeCity(q);
      setSuggestions(results);
      setSearching(false);
    }, 400);
  };

    const handleSelectCity = async (r: GeocodingResult) => {
    setState("loading");
    setSuggestions([]);
    setSearchQuery("");
    setActiveIndex(-1);
    
    let temp: number | null = null;
    if (viewMode === "forecast") {
      const w = await fetchSingleForecast(r.lat, r.lng, 7);
      temp = w?.temperatureMax ?? null;
    } else {
      const w = await fetchSingleWeather(r.lat, r.lng);
      temp = w?.temperature ?? null;
    }
    (window as any).dataLayer = (window as any).dataLayer || [];
    (window as any).dataLayer.push({
      event: "select_city",
      city_name: r.name,
      country: r.country
    });
    onLocationSet(
      {
        lat: r.lat,
        lng: r.lng,
        label: r.admin1 ? `${r.name}, ${r.admin1}` : `${r.name}, ${r.country}`
      },
      temp
    );
    setState("located");
  };

  if (state === "located" && userLocation) {
    const isForecast = viewMode === "forecast";
    const tempLabel = isForecast && userTemp !== null 
      ? `${formatTemp(userTemp, unit)} (in 7d)` 
      : (userTemp !== null ? formatTemp(userTemp, unit) : "");

    return (
      <div className={`location-panel located ${embed ? "embedded" : ""}`} id="location-panel">
        <div className="location-panel-inner">
          <span className="location-label">📍 {userLocation.label}</span>
          {userTemp !== null && (
            <span className="location-temp">{tempLabel}</span>
          )}
          
          <div className="mode-toggle">
            <button
              className={`mode-btn ${viewMode === "now" ? "active" : ""}`}
              onClick={() => onViewModeChange("now")}
            >
              Now
            </button>
            <button
              className={`mode-btn ${viewMode === "forecast" ? "active" : ""}`}
              onClick={() => onViewModeChange("forecast")}
            >
              7 Days
            </button>
          </div>

          {!embed && (
            <button
              className="change-location-btn"
              onClick={() => setState("search")}
              id="change-location-btn"
            >
              Change
            </button>
          )}
          {embed && (
            <a
              href={`https://colder.itiszack.com/?lat=${userLocation.lat}&lng=${userLocation.lng}`}
              target="_blank"
              rel="noopener noreferrer"
              className="change-location-btn"
              id="open-full-btn"
            >
              Open ↗
            </a>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`location-panel glass ${embed ? "embedded" : ""}`} id="location-panel">
      <div className="location-panel-inner">
        <header>
          <div className="app-logo">🌡️</div>
          <h1 className="app-title">Cold Locator</h1>
          <p className="app-subtitle">Find places colder than where you are</p>
        </header>

        {state === "requesting" && (
          <div className="location-status">
            <div className="spinner" />
            <span>Requesting your location…</span>
          </div>
        )}

        {state === "loading" && (
          <div className="location-status">
            <div className="spinner" />
            <span>Loading weather data…</span>
          </div>
        )}

        {(state === "search" || state === "requesting") && (
          <search className="search-container">
            {error && <p className="location-error">{error}</p>}
            <div className="search-input-wrap">
              <input
                id="city-search"
                type="text"
                placeholder="Search your city…"
                value={searchQuery}
                onChange={(e) => handleSearchInput(e.target.value)}
                className="search-input"
                autoComplete="off"
                role="combobox"
                aria-expanded={suggestions.length > 0}
                aria-controls={listboxId}
                aria-activedescendant={activeIndex >= 0 ? `suggestion-${activeIndex}` : undefined}
                aria-autocomplete="list"
              />
              {searching && <div className="spinner search-spinner" />}
            </div>
            {suggestions.length > 0 && (
              <ul className="suggestions-list" role="listbox" id={listboxId} aria-live="polite">
                {suggestions.map((r, i) => (
                  <li
                    key={i}
                    role="option"
                    className="suggestion-item"
                    onClick={() => handleSelectCity(r)}
                    id={`suggestion-${i}`}
                    aria-selected={i === activeIndex}
                  >
                    <span className="suggestion-name">{r.name}</span>
                    <span className="suggestion-meta">
                      {r.admin1 ? `${r.admin1}, ` : ""}{r.country}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </search>
        )}
      </div>
    </div>
  );
}
