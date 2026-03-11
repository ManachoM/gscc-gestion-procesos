import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../lib/api";
import { useAuth } from "../contexts/AuthContext";

export default function AdminPanel() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<{ message: string } | null>(null);

  useEffect(() => {
    api.get<{ message: string }>("/api/v1/admin/dashboard").then((r) => setData(r.data));
  }, []);

  return (
    <main style={{ fontFamily: "sans-serif", padding: "2rem" }}>
      <h1>Admin Panel</h1>
      {data && <p>{data.message}</p>}
      <p><a href="/">← Back to Dashboard</a></p>
      <button onClick={() => { logout(); navigate("/login", { replace: true }); }}>Sign out</button>
    </main>
  );
}
