import { useState } from "react";

interface Props {
  lat: number;
  lng: number;
  onSave: (name: string, address: string) => void;
  onCancel: () => void;
}

export default function AddMarkerDialog({ lat, lng, onSave, onCancel }: Props) {
  const [name, setName] = useState("");
  const [address, setAddress] = useState(`${lat.toFixed(4)}, ${lng.toFixed(4)}`);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !address.trim()) return;
    onSave(name.trim(), address.trim());
  };

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div
        className="modal-content glass"
        role="dialog"
        aria-labelledby="modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2 className="settings-title" id="modal-title">Add Marker</h2>
          <button className="settings-close" onClick={onCancel} aria-label="Cancel">✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="selected-loc-info">
              <span className="loc-label">Coordinates</span>
              <span className="loc-val">{lat.toFixed(6)}, {lng.toFixed(6)}</span>
            </div>
            
            <div className="form-group">
              <label htmlFor="dialog-name" className="form-label">Name on Map</label>
              <input
                id="dialog-name"
                type="text"
                className="search-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. My Cabin"
                required
                maxLength={40}
                autoFocus
              />
            </div>

            <div className="form-group">
              <label htmlFor="dialog-address" className="form-label">Address / Notes</label>
              <input
                id="dialog-address"
                type="text"
                className="search-input"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Address"
                required
                maxLength={100}
              />
            </div>

            <div className="form-actions">
              <button type="submit" className="save-btn">Save Marker</button>
              <button type="button" className="cancel-btn" onClick={onCancel}>Cancel</button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
