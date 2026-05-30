import { useState, useEffect } from "react";

interface HealthData {
  worker: "ok" | "error" | "unknown";
  nws: "ok" | "error" | "unknown";
  openMeteo: "ok" | "error" | "unknown";
  timestamp: number;
}

export default function ApiStatus() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeAgo, setTimeAgo] = useState("just now");

  useEffect(() => {
    let mounted = true;

    async function checkHealth() {
      try {
        setLoading(true);
        // Direct Open-Meteo client-side check
        const omRes = await fetch("https://api.open-meteo.com/v1/forecast?latitude=0&longitude=0&current=temperature_2m&forecast_days=1", {
          method: "HEAD"
        }).catch(() => null);
        const omOk = omRes?.ok ? "ok" : "error";

        // Worker proxy + NWS check
        const workerRes = await fetch("/api/health").catch(() => null);
        let workerOk: "ok" | "error" = "error";
        let nwsOk: "ok" | "error" | "unknown" = "unknown";
        
        if (workerRes?.ok) {
          workerOk = "ok";
          try {
            const data = await workerRes.json() as any;
            nwsOk = data.nws;
          } catch (e) {
            // parsing error
          }
        }

        if (mounted) {
          setHealth({
            worker: workerOk,
            nws: nwsOk,
            openMeteo: omOk,
            timestamp: Date.now()
          });
          setLoading(false);
          setTimeAgo("just now");
        }
      } catch (err) {
        if (mounted) {
          setHealth({
            worker: "error",
            nws: "unknown",
            openMeteo: "unknown",
            timestamp: Date.now()
          });
          setLoading(false);
        }
      }
    }

    checkHealth();

    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!health) return;
    
    const interval = setInterval(() => {
      const diff = Math.floor((Date.now() - health.timestamp) / 1000);
      if (diff < 10) setTimeAgo("just now");
      else if (diff < 60) setTimeAgo(`${diff}s ago`);
      else setTimeAgo(`${Math.floor(diff / 60)}m ago`);
    }, 5000);
    
    return () => clearInterval(interval);
  }, [health]);

  const renderStatusDot = (status: "ok" | "error" | "unknown") => {
    if (loading) return <span className="api-dot checking" title="Checking..." />;
    if (status === "ok") return <span className="api-dot ok" title="OK" />;
    if (status === "error") return <span className="api-dot error" title="Error" />;
    return <span className="api-dot checking" title="Unknown" />;
  };

  return (
    <div className="api-status-section">
      <label className="settings-label">DATA SOURCES</label>
      <div className="api-status-grid">
        <div className="api-status-row">
          {renderStatusDot(health?.openMeteo || "unknown")}
          <span className="api-status-name">Open-Meteo (Weather)</span>
        </div>
        <div className="api-status-row">
          {renderStatusDot(health?.nws || "unknown")}
          <span className="api-status-name">NWS Alerts (US)</span>
        </div>
        <div className="api-status-row">
          {renderStatusDot(health?.worker || "unknown")}
          <span className="api-status-name">Worker Proxy</span>
        </div>
        <div className="api-status-time">
          ⏱️ Checked {loading ? "..." : timeAgo}
        </div>
      </div>
    </div>
  );
}
