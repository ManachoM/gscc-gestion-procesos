import { useEffect, useState } from "react";

const API_URL = import.meta.env.VITE_API_URL ?? "";

interface HealthResponse {
  status: string;
  service: string;
}

function App() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/health`)
      .then((res) => res.json())
      .then((data: HealthResponse) => setHealth(data))
      .catch((err: Error) => setError(err.message));
  }, []);

  return (
    <main style={{ fontFamily: "sans-serif", padding: "2rem" }}>
      <h1>GSCC — Gestión de Procesos</h1>
      <p>Worker process manager</p>
      <hr />
      <h2>API Status</h2>
      {error && <p style={{ color: "red" }}>Error: {error}</p>}
      {health && (
        <p style={{ color: "green" }}>
          Backend: <strong>{health.status}</strong>
        </p>
      )}
      {!health && !error && <p>Connecting to backend…</p>}
    </main>
  );
}

export default App;
