import { useState, useRef } from "react";
import type { CustomMarker } from "../App";
import { geocodeCity, type GeocodingResult } from "../lib/mapUtils";

interface Props {
  savedMarkers: CustomMarker[];
  onAddMarker: (marker: CustomMarker) => void;
  onDeleteMarker: (id: string) => void;
  onClose: () => void;
  onFocusMarker: (lat: number, lng: number) => void;
}

export default function SavedMarkersPanel({
  savedMarkers,
  onAddMarker,
  onDeleteMarker,
  onClose,
  onFocusMarker,
}: Props) {
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState<GeocodingResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<GeocodingResult | null>(null);
  const [markerName, setMarkerName] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listboxId = "marker-suggestions";

  const handleSearchInput = (q: string) => {
    setSearchQuery(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.length < 2) {
      setSuggestions([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      const results = await geocodeCity(q);
      setSuggestions(results);
      setSearching(false);
    }, 400);
  };

  const handleSelectLocation = (r: GeocodingResult) => {
    setSelectedLocation(r);
    setMarkerName(r.name);
    setSearchQuery("");
    setSuggestions([]);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLocation || !markerName.trim()) return;

    const address = selectedLocation.admin1
      ? `${selectedLocation.name}, ${selectedLocation.admin1}, ${selectedLocation.country}`
      : `${selectedLocation.name}, ${selectedLocation.country}`;

    onAddMarker({
      id: Date.now().toString(),
      name: markerName.trim(),
      address,
      lat: selectedLocation.lat,
      lng: selectedLocation.lng,
    });

    setSelectedLocation(null);
    setMarkerName("");
  };

  const handleCancelSelection = () => {
    setSelectedLocation(null);
    setMarkerName("");
  };

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div
        className="settings-panel glass"
        id="saved-markers-panel"
        role="dialog"
        aria-labelledby="saved-markers-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="settings-header">
          <h2 className="settings-title" id="saved-markers-title">Saved Locations</h2>
          <button className="settings-close" onClick={onClose} id="saved-markers-close-btn" aria-label="Close saved locations">✕</button>
        </div>

        <div className="settings-section">
          <label className="settings-label">Add Custom Marker</label>
          
          {!selectedLocation ? (
            <div className="search-container">
              <div className="search-input-wrap">
                <input
                  id="marker-search"
                  type="text"
                  placeholder="Search address or city…"
                  value={searchQuery}
                  onChange={(e) => handleSearchInput(e.target.value)}
                  className="search-input"
                  autoComplete="off"
                  role="combobox"
                  aria-expanded={suggestions.length > 0}
                  aria-controls={listboxId}
                  aria-autocomplete="list"
                />
                {searching && <div className="spinner search-spinner" />}
              </div>
              {suggestions.length > 0 && (
                <ul className="suggestions-list" role="listbox" id={listboxId}>
                  {suggestions.map((r, i) => (
                    <li
                      key={i}
                      role="option"
                      className="suggestion-item"
                      onClick={() => handleSelectLocation(r)}
                      id={`marker-suggestion-${i}`}
                    >
                      <span className="suggestion-name">{r.name}</span>
                      <span className="suggestion-meta">
                        {r.admin1 ? `${r.admin1}, ` : ""}{r.country}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <form onSubmit={handleSave} className="marker-form">
              <div className="selected-loc-info">
                <span className="loc-label">Address:</span>
                <span className="loc-val">
                  {selectedLocation.admin1 ? `${selectedLocation.name}, ${selectedLocation.admin1}, ${selectedLocation.country}` : `${selectedLocation.name}, ${selectedLocation.country}`}
                </span>
              </div>
              <div className="form-group">
                <label htmlFor="marker-name-input" className="form-label">Name on Map</label>
                <input
                  id="marker-name-input"
                  type="text"
                  className="search-input"
                  value={markerName}
                  onChange={(e) => setMarkerName(e.target.value)}
                  placeholder="e.g. My Cabin"
                  required
                  maxLength={40}
                  autoFocus
                />
              </div>
              <div className="form-actions">
                <button type="submit" className="save-btn">Save</button>
                <button type="button" className="cancel-btn" onClick={handleCancelSelection}>Cancel</button>
              </div>
            </form>
          )}
        </div>

        <div className="settings-section saved-list-section">
          <label className="settings-label">My Markers ({savedMarkers.length})</label>
          {savedMarkers.length === 0 ? (
            <div className="empty-markers">
              <span className="empty-icon">📍</span>
              <p>No saved markers yet. Add a location above to see it on the map.</p>
            </div>
          ) : (
            <ul className="saved-markers-list">
              {savedMarkers.map((m) => (
                <li key={m.id} className="saved-marker-item">
                  <div className="saved-marker-info" onClick={() => onFocusMarker(m.lat, m.lng)}>
                    <div className="saved-marker-item-name">{m.name}</div>
                    <div className="saved-marker-item-addr">{m.address}</div>
                  </div>
                  <button
                    className="delete-marker-btn"
                    onClick={() => onDeleteMarker(m.id)}
                    aria-label={`Delete ${m.name}`}
                    title="Delete"
                  >
                    🗑️
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
