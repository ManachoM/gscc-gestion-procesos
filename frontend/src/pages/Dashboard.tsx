import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  return (
    <main style={{ fontFamily: "sans-serif", padding: "2rem" }}>
      <h1>GSCC — Dashboard</h1>
      <p>
        Signed in as <strong>{user?.sub}</strong> &nbsp;·&nbsp; role: <strong>{user?.role}</strong>
      </p>
      {user?.role === "admin" && (
        <p>
          <a href="/admin">Go to Admin Panel →</a>
        </p>
      )}
      <button onClick={handleLogout}>Sign out</button>
    </main>
  );
}
