import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../lib/api";
import { useAuth } from "../contexts/AuthContext";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { data } = await api.post<{ access_token: string }>("/api/v1/auth/login", {
        email,
        password,
      });
      login(data.access_token);
      navigate("/", { replace: true });
    } catch {
      setError("Invalid email or password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ fontFamily: "sans-serif", maxWidth: 360, margin: "6rem auto", padding: "0 1rem" }}>
      <h1>GSCC — Sign in</h1>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{ display: "block", width: "100%", padding: "0.4rem", marginTop: "0.25rem" }}
          />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{ display: "block", width: "100%", padding: "0.4rem", marginTop: "0.25rem" }}
          />
        </label>
        {error && <p style={{ color: "red", margin: 0 }}>{error}</p>}
        <button type="submit" disabled={loading} style={{ padding: "0.5rem" }}>
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </main>
  );
}
