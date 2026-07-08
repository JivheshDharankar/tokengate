import { useState, useRef, useCallback, useEffect } from "react";
import "./App.css";

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:5000";
const API_KEY = import.meta.env.VITE_API_KEY ?? "tokengate-demo-key-2026";
const API_HEADERS = { "x-api-key": API_KEY };

function getLogText(r) {
  if (r.ok) return "Request allowed";
  if (r.error) return "Connection failed";
  if (r.status === 401) return "Unauthorized — invalid API key";
  if (r.status === 429) return "Rate limited — 429";
  return `Request failed — ${r.status}`;
}

function App() {
  const [requests, setRequests] = useState([]);
  const [tokens, setTokens] = useState(10);
  const [capacity, setCapacity] = useState(10);
  const [algo, setAlgo] = useState("token");
  const [isSpamming, setIsSpamming] = useState(false);
  const [retryAfter, setRetryAfter] = useState(0);
  const idCounter = useRef(0);
  const algoRef = useRef(algo);

  useEffect(() => {
    algoRef.current = algo;
  }, [algo]);

  const pollStatus = useCallback(async () => {
    try {
      const currentAlgo = algoRef.current;
      const endpoint = currentAlgo === "sliding" ? "/api/status/sliding" : "/api/status/token";
      const res = await fetch(`${API_BASE}${endpoint}`, { headers: API_HEADERS });
      if (!res.ok) return;
      const data = await res.json();
      if (currentAlgo === "sliding") {
        setTokens(data.requests ?? 0);
        setCapacity(data.limit ?? 10);
      } else {
        setTokens(data.tokens ?? 10);
        if (data.capacity != null) setCapacity(data.capacity);
      }
    } catch {
      // ignore
    }
  }, []);

  const sendRequest = useCallback(async () => {
    const id = idCounter.current++;
    const startTime = Date.now();
    const currentAlgo = algoRef.current;

    try {
      const res = await fetch(`${API_BASE}/api/ping?algo=${currentAlgo}`, { headers: API_HEADERS });
      const remaining = res.headers.get("X-RateLimit-Remaining");
      const cap = res.headers.get("X-RateLimit-Capacity");
      const limit = cap != null ? Number(cap) : 10;

      if (cap !== null) setCapacity(limit);

      if (res.status === 429) {
        if (currentAlgo === "sliding") setTokens(limit);
        else setTokens(0);
        const retry = res.headers.get("Retry-After");
        if (retry !== null) setRetryAfter(Number(retry));
      } else if (remaining !== null) {
        if (currentAlgo === "sliding") {
          setTokens(limit - Number(remaining));
        } else {
          setTokens(Number(remaining));
        }
      }

      setRequests((prev) =>
        [{ id, status: res.status, ok: res.ok, time: new Date(startTime).toLocaleTimeString("en-US", { hour12: false }) }, ...prev].slice(0, 30)
      );
    } catch {
      setRequests((prev) =>
        [{ id, status: 0, ok: false, error: true, time: new Date(startTime).toLocaleTimeString("en-US", { hour12: false }) }, ...prev].slice(0, 30)
      );
    }
  }, []);

  const spamRequests = useCallback(async (count) => {
  setIsSpamming(true);
  for (let i = 0; i < count; i++) {
    await sendRequest();
    await new Promise((r) => setTimeout(r, 80));
  }
  setIsSpamming(false);
}, [sendRequest]);

  useEffect(() => {
    setTokens(algo === "sliding" ? 0 : 10);
    pollStatus();
  }, [algo]);

  useEffect(() => {
    if (isSpamming) return;
    const id = setInterval(pollStatus, 2000);
    return () => clearInterval(id);
  }, [isSpamming]);

  useEffect(() => {
    if (retryAfter <= 0) return;
    const id = setInterval(() => setRetryAfter((p) => Math.max(0, p - 1)), 1000);
    return () => clearInterval(id);
  }, [retryAfter]);

  const allowedCount = requests.filter((r) => r.ok).length;
  const blockedCount = requests.filter((r) => r.status === 429).length;
  const isSliding = algo === "sliding";
  const fillPercent = Math.max(0, Math.min(100, (tokens / capacity) * 100));

  return (
    <div className="app">
      <div className="scanline" />
      <header className="header">
        <div className="header-eyebrow">// infrastructure / rate-limiter</div>
        <h1>Token<span className="accent">Gate</span></h1>
        <p className="subtitle">A token-bucket rate limiter backed by Redis. Watch it throttle requests in real time.</p>
      </header>

      <main className="main-grid">
        <section className="panel bucket-panel">
          <div className="panel-label">{isSliding ? "window state" : "bucket state"}</div>
          <div className="bucket-visual">
            <div className="bucket-frame">
              <div className="bucket-fill" style={{ height: `${fillPercent}%` }} />
              <div className="bucket-count">
                <span className="count-num">{isSliding ? tokens : typeof tokens === "number" ? tokens.toFixed(1) : tokens}</span>
                <span className="count-cap">/ {capacity}</span>
              </div>
            </div>
          </div>
          <div className="bucket-meta">
            {isSliding ? (
              <>
                <div className="meta-row"><span>metric</span><span className="mono">requests in window</span></div>
                <div className="meta-row"><span>window</span><span className="mono">10 sec</span></div>
              </>
            ) : (
              <>
                <div className="meta-row"><span>refill rate</span><span className="mono">1 token / sec</span></div>
                <div className="meta-row"><span>capacity</span><span className="mono">{capacity} tokens</span></div>
              </>
            )}
          </div>
        </section>

        <section className="panel controls-panel">
          <div className="panel-label">algorithm</div>
          <div className="algo-toggle">
            <button type="button" className={`algo-btn ${algo === "token" ? "active" : ""}`} onClick={() => setAlgo("token")}>Token Bucket</button>
            <button type="button" className={`algo-btn ${algo === "sliding" ? "active" : ""}`} onClick={() => setAlgo("sliding")}>Sliding Window</button>
          </div>

          <div className="panel-label">send requests</div>
          <div className="button-row">
            <button onClick={sendRequest} disabled={isSpamming} className="btn btn-primary">Send 1 Request</button>
            <button onClick={() => spamRequests(15)} disabled={isSpamming} className="btn btn-danger">{isSpamming ? "Spamming..." : "Spam 15 Requests"}</button>
          </div>

          <div className="stats-row">
            <div className="stat"><span className="stat-num allowed">{allowedCount}</span><span className="stat-label">allowed</span></div>
            <div className="stat"><span className="stat-num blocked">{blockedCount}</span><span className="stat-label">blocked</span></div>
          </div>

          {retryAfter > 0 && <div className="retry-banner">Rate limited — retry in {retryAfter}s</div>}

          <div className="log-panel">
            <div className="panel-label">request log</div>
            <div className="log-list">
              {requests.length === 0 && <div className="log-empty">No requests sent yet. Try spamming the bucket.</div>}
              {requests.map((r) => (
                <div key={r.id} className={`log-entry ${r.ok ? "log-ok" : "log-blocked"}`}>
                  <span className="log-time mono">{r.time}</span>
                  <span className="log-status mono">{r.status || "ERR"}</span>
                  <span className="log-text">{getLogText(r)}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="footer">
        <span className="mono">algorithm: {isSliding ? "sliding window" : "token bucket"}</span>
        <span className="dot">•</span>
        <span className="mono">store: redis (upstash)</span>
        <span className="dot">•</span>
        <span className="mono">stack: node.js + express</span>
      </footer>
    </div>
  );
}

export default App;
