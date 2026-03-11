import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

function NavLink({ to, children }: { to: string; children: React.ReactNode }) {
  const { pathname } = useLocation();
  // Mark active when the path matches exactly or starts with the target prefix
  const active = pathname === to || (to !== "/" && pathname.startsWith(to));
  return (
    <Link
      to={to}
      style={{
        color: active ? "#111" : "#555",
        textDecoration: "none",
        fontWeight: active ? 600 : 400,
        borderBottom: active ? "2px solid #333" : "2px solid transparent",
        paddingBottom: "2px",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </Link>
  );
}

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const isStaff = user?.role === "admin" || user?.role === "operator";
  const isAdmin = user?.role === "admin";

  return (
    <div style={{ fontFamily: "sans-serif", minHeight: "100vh", background: "#fafafa" }}>
      <nav
        style={{
          background: "#fff",
          borderBottom: "1px solid #ddd",
          padding: "0 2rem",
          display: "flex",
          alignItems: "center",
          gap: "1.5rem",
          height: "48px",
          flexWrap: "nowrap",
          overflowX: "auto",
        }}
      >
        {/* Brand */}
        <NavLink to="/">
          <strong style={{ fontSize: "1rem" }}>GSCC</strong>
        </NavLink>

        <span style={{ color: "#ddd" }}>|</span>

        {/* Always visible */}
        <NavLink to="/artifacts">Artifacts</NavLink>

        {/* Operator + Admin */}
        {isStaff && (
          <>
            <NavLink to="/workflows">Workflows</NavLink>
            <NavLink to="/executions">Runs</NavLink>
            <NavLink to="/schedules">Schedules</NavLink>
          </>
        )}

        {/* Admin only */}
        {isAdmin && (
          <>
            <span style={{ color: "#ddd" }}>|</span>
            <NavLink to="/admin/workflows">Manage Workflows</NavLink>
            <NavLink to="/admin">Users</NavLink>
          </>
        )}

        {/* Spacer + user controls */}
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "0.75rem" }}>
          {user ? (
            <>
              <span style={{ color: "#888", fontSize: "0.85rem", whiteSpace: "nowrap" }}>
                {user.sub} · <em>{user.role}</em>
              </span>
              <button
                onClick={() => { logout(); navigate("/login"); }}
                style={{ padding: "0.25rem 0.65rem", cursor: "pointer", fontSize: "0.85rem" }}
              >
                Sign out
              </button>
            </>
          ) : (
            <NavLink to="/login">Sign in</NavLink>
          )}
        </div>
      </nav>

      <Outlet />
    </div>
  );
}
