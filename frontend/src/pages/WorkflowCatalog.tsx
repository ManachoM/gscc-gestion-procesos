import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../lib/api";
import StatusBadge from "../components/StatusBadge";
import { apiError, type Workflow } from "../types";

const tdStyle: React.CSSProperties = { padding: "0.75rem 1rem", borderBottom: "1px solid #eee", verticalAlign: "top" };
const thStyle: React.CSSProperties = { padding: "0.5rem 1rem", background: "#f5f5f5", textAlign: "left", borderBottom: "1px solid #ddd" };

export default function WorkflowCatalog() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<Workflow[]>("/api/v1/workflows")
      .then(({ data }) => setWorkflows(data))
      .catch((err) => setError(apiError(err, "Failed to load workflows.")))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={{ padding: "2rem", maxWidth: 1000, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <h1 style={{ margin: 0 }}>Workflows</h1>
      </div>

      {error && (
        <p style={{ color: "red", background: "#fff0f0", padding: "0.5rem 1rem", borderLeft: "4px solid red" }}>
          {error}
        </p>
      )}

      {loading ? (
        <p style={{ color: "#888" }}>Loading…</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", background: "#fff" }}>
          <thead>
            <tr>
              <th style={thStyle}>Workflow</th>
              <th style={thStyle}>Status</th>
              <th style={thStyle}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {workflows.map((wf) => (
              <tr key={wf.slug}>
                <td style={tdStyle}>
                  <div style={{ fontWeight: 600 }}>{wf.name}</div>
                  <div style={{ color: "#888", fontSize: "0.8rem" }}>{wf.slug}</div>
                  {wf.description && (
                    <div style={{ color: "#555", fontSize: "0.85rem", marginTop: "0.25rem" }}>{wf.description}</div>
                  )}
                </td>
                <td style={{ ...tdStyle, whiteSpace: "nowrap" }}>
                  <StatusBadge status={wf.status} />
                </td>
                <td style={{ ...tdStyle, whiteSpace: "nowrap" }}>
                  {wf.status === "published" ? (
                    <Link
                      to={`/workflows/${wf.slug}/run`}
                      style={{
                        display: "inline-block",
                        padding: "0.3rem 0.75rem",
                        background: "#1a56cc",
                        color: "#fff",
                        borderRadius: "3px",
                        textDecoration: "none",
                        fontSize: "0.9rem",
                      }}
                    >
                      ▶ Run
                    </Link>
                  ) : (
                    <span style={{ color: "#aaa", fontSize: "0.85rem" }}>Not available</span>
                  )}
                </td>
              </tr>
            ))}
            {workflows.length === 0 && !loading && (
              <tr>
                <td colSpan={3} style={{ textAlign: "center", padding: "2.5rem", color: "#888" }}>
                  No published workflows available.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
