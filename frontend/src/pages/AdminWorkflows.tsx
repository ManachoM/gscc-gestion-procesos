import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../lib/api";
import StatusBadge from "../components/StatusBadge";
import { fmtDateTime } from "../lib/utils";
import { apiError, type Workflow, type WorkflowStatus } from "../types";

const thStyle: React.CSSProperties = { padding: "0.5rem 0.75rem", background: "#f5f5f5", textAlign: "left", borderBottom: "1px solid #ddd", whiteSpace: "nowrap" };
const tdStyle: React.CSSProperties = { padding: "0.5rem 0.75rem", borderBottom: "1px solid #eee", verticalAlign: "top" };
const btnStyle: React.CSSProperties = { padding: "0.25rem 0.6rem", cursor: "pointer", marginRight: "0.3rem", fontSize: "0.85rem" };

export default function AdminWorkflows() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function fetchWorkflows() {
    try {
      const { data } = await api.get<Workflow[]>("/api/v1/workflows");
      setWorkflows(data);
    } catch (err) {
      setError(apiError(err, "Failed to load workflows."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchWorkflows(); }, []);

  async function handleStatus(slug: string, status: WorkflowStatus) {
    try {
      await api.patch(`/api/v1/workflows/${slug}`, { status });
      await fetchWorkflows();
    } catch (err) {
      setError(apiError(err, `Failed to set workflow to ${status}.`));
    }
  }

  return (
    <div style={{ padding: "2rem", maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <h1 style={{ margin: 0 }}>Manage Workflows</h1>
        <button style={btnStyle} onClick={fetchWorkflows}>Refresh</button>
      </div>
      <p style={{ color: "#555", marginBottom: "1.5rem" }}>
        Workflows are defined in code. Publish them to make them available to operators.
        Archived workflows cannot be run but their history is preserved.
      </p>

      {error && (
        <p style={{ color: "red", background: "#fff0f0", padding: "0.5rem 1rem", borderLeft: "4px solid red", marginBottom: "1rem" }}>
          {error}{" "}
          <button onClick={() => setError(null)} style={{ cursor: "pointer" }}>✕</button>
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
              <th style={thStyle}>In code</th>
              <th style={thStyle}>Updated</th>
              <th style={thStyle}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {workflows.map((wf) => (
              <tr key={wf.slug}>
                <td style={tdStyle}>
                  <Link to={`/admin/workflows/${wf.slug}`} style={{ fontWeight: 600 }}>{wf.name}</Link>
                  <div style={{ color: "#888", fontSize: "0.8rem" }}>{wf.slug}</div>
                  {wf.description && (
                    <div style={{ color: "#555", fontSize: "0.82rem", marginTop: "0.2rem" }}>{wf.description}</div>
                  )}
                </td>
                <td style={{ ...tdStyle, whiteSpace: "nowrap" }}>
                  <StatusBadge status={wf.status} />
                </td>
                <td style={{ ...tdStyle, textAlign: "center" }}>
                  {wf.is_registered ? (
                    <span style={{ color: "#1a6e2a" }}>✓</span>
                  ) : (
                    <span style={{ color: "#b91c1c" }} title="Slug not found in code registry">✗ orphaned</span>
                  )}
                </td>
                <td style={{ ...tdStyle, whiteSpace: "nowrap", fontSize: "0.85rem" }}>{fmtDateTime(wf.updated_at)}</td>
                <td style={{ ...tdStyle, whiteSpace: "nowrap" }}>
                  {wf.status === "draft" && (
                    <button style={btnStyle} onClick={() => handleStatus(wf.slug, "published")}>
                      Publish
                    </button>
                  )}
                  {wf.status === "published" && (
                    <button style={{ ...btnStyle, color: "#7d6608" }} onClick={() => handleStatus(wf.slug, "archived")}>
                      Archive
                    </button>
                  )}
                  {wf.status === "archived" && (
                    <button style={btnStyle} onClick={() => handleStatus(wf.slug, "published")}>
                      Re-publish
                    </button>
                  )}
                  <Link to={`/admin/workflows/${wf.slug}`} style={{ fontSize: "0.85rem", marginLeft: "0.25rem" }}>
                    Details →
                  </Link>
                </td>
              </tr>
            ))}
            {workflows.length === 0 && (
              <tr>
                <td colSpan={5} style={{ textAlign: "center", padding: "2.5rem", color: "#888" }}>
                  No workflows discovered. Deploy a backend with workflow modules registered.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
