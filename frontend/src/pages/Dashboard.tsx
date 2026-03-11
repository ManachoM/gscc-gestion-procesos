import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

const cardStyle: React.CSSProperties = {
  border: "1px solid #ddd",
  borderRadius: "4px",
  padding: "1.25rem 1.5rem",
  background: "#fff",
  textDecoration: "none",
  color: "inherit",
  display: "block",
};

const sectionStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
  gap: "1rem",
  marginBottom: "2rem",
};

export default function Dashboard() {
  const { user } = useAuth();
  const isOperator = user?.role === "operator" || user?.role === "admin";
  const isAdmin = user?.role === "admin";

  return (
    <div style={{ padding: "2rem", maxWidth: 900, margin: "0 auto" }}>
      <h1 style={{ marginTop: 0 }}>Dashboard</h1>
      <p style={{ color: "#555", marginBottom: "2rem" }}>
        Signed in as <strong>{user?.sub}</strong> · role: <strong>{user?.role}</strong>
      </p>

      {/* Public section — always visible */}
      <h2 style={{ fontSize: "1rem", color: "#888", marginBottom: "0.75rem" }}>Public</h2>
      <div style={sectionStyle}>
        <Link to="/artifacts" style={cardStyle}>
          <strong>Artifacts</strong>
          <p style={{ margin: "0.25rem 0 0", color: "#666", fontSize: "0.9rem" }}>
            Browse and download published data files
          </p>
        </Link>
      </div>

      {/* Operator section */}
      {isOperator && (
        <>
          <h2 style={{ fontSize: "1rem", color: "#888", marginBottom: "0.75rem" }}>Operations</h2>
          <div style={sectionStyle}>
            <Link to="/workflows" style={cardStyle}>
              <strong>Workflows</strong>
              <p style={{ margin: "0.25rem 0 0", color: "#666", fontSize: "0.9rem" }}>
                Browse published workflows and trigger runs
              </p>
            </Link>
            <Link to="/executions" style={cardStyle}>
              <strong>Runs</strong>
              <p style={{ margin: "0.25rem 0 0", color: "#666", fontSize: "0.9rem" }}>
                View and monitor your execution history
              </p>
            </Link>
            <Link to="/schedules" style={cardStyle}>
              <strong>Schedules</strong>
              <p style={{ margin: "0.25rem 0 0", color: "#666", fontSize: "0.9rem" }}>
                Manage one-off and recurring schedule entries
              </p>
            </Link>
          </div>
        </>
      )}

      {/* Admin section */}
      {isAdmin && (
        <>
          <h2 style={{ fontSize: "1rem", color: "#888", marginBottom: "0.75rem" }}>Administration</h2>
          <div style={sectionStyle}>
            <Link to="/admin/workflows" style={cardStyle}>
              <strong>Manage Workflows</strong>
              <p style={{ margin: "0.25rem 0 0", color: "#666", fontSize: "0.9rem" }}>
                Publish, archive, and inspect workflow schemas
              </p>
            </Link>
            <Link to="/admin" style={cardStyle}>
              <strong>User Management</strong>
              <p style={{ margin: "0.25rem 0 0", color: "#666", fontSize: "0.9rem" }}>
                Create and manage user accounts
              </p>
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
