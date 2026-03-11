import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api from "../lib/api";
import StatusBadge from "../components/StatusBadge";
import { fmtDateTime, duration } from "../lib/utils";
import { apiError, type Execution, type Workflow, type WorkflowStatus } from "../types";

const tdStyle: React.CSSProperties = { padding: "0.45rem 0.75rem", borderBottom: "1px solid #eee", verticalAlign: "top" };
const thCell: React.CSSProperties = { ...tdStyle, background: "#f5f5f5", textAlign: "left", fontWeight: 500, width: "140px" };
const thStyle: React.CSSProperties = { padding: "0.5rem 0.75rem", background: "#f5f5f5", textAlign: "left", borderBottom: "1px solid #ddd", whiteSpace: "nowrap" };
const btnStyle: React.CSSProperties = { padding: "0.3rem 0.75rem", cursor: "pointer", marginRight: "0.4rem" };

export default function AdminWorkflowDetail() {
  const { slug } = useParams<{ slug: string }>();

  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function fetchAll() {
    if (!slug) return;
    try {
      const [wfRes, execRes] = await Promise.all([
        api.get<Workflow>(`/api/v1/workflows/${slug}`),
        api.get<Execution[]>(`/api/v1/workflows/${slug}/executions?limit=20`),
      ]);
      setWorkflow(wfRes.data);
      setExecutions(execRes.data);
    } catch (err) {
      setError(apiError(err, "Failed to load workflow."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchAll(); }, [slug]);

  async function handleStatus(status: WorkflowStatus) {
    if (!workflow) return;
    try {
      await api.patch(`/api/v1/workflows/${workflow.slug}`, { status });
      await fetchAll();
    } catch (err) {
      setError(apiError(err, `Failed to update status to ${status}.`));
    }
  }

  if (loading) return <div style={{ padding: "2rem" }}>Loading…</div>;

  if (error || !workflow) {
    return (
      <div style={{ padding: "2rem" }}>
        <Link to="/admin/workflows">← Back to workflows</Link>
        <p style={{ color: "red", marginTop: "1rem" }}>{error ?? "Workflow not found."}</p>
      </div>
    );
  }

  const props = workflow.param_schema.properties ?? {};
  const required = new Set(workflow.param_schema.required ?? []);

  return (
    <div style={{ padding: "2rem", maxWidth: 1000, margin: "0 auto" }}>
      <Link to="/admin/workflows" style={{ color: "#555", fontSize: "0.9rem" }}>← Back to workflows</Link>

      {error && (
        <p style={{ color: "red", background: "#fff0f0", padding: "0.5rem 1rem", borderLeft: "4px solid red", margin: "1rem 0" }}>
          {error}{" "}
          <button onClick={() => setError(null)} style={{ cursor: "pointer" }}>✕</button>
        </p>
      )}

      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginTop: "1rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
        <h1 style={{ margin: 0 }}>{workflow.name}</h1>
        <StatusBadge status={workflow.status} />
        {!workflow.is_registered && (
          <span style={{ background: "#fde8e8", color: "#b91c1c", padding: "0.15rem 0.5rem", borderRadius: "3px", fontSize: "0.82rem" }}>
            ⚠ not in code registry
          </span>
        )}
        <div style={{ marginLeft: "auto", display: "flex", gap: "0.5rem" }}>
          {workflow.status === "draft" && (
            <button style={btnStyle} onClick={() => handleStatus("published")}>Publish</button>
          )}
          {workflow.status === "published" && (
            <button style={{ ...btnStyle, color: "#7d6608" }} onClick={() => handleStatus("archived")}>Archive</button>
          )}
          {workflow.status === "archived" && (
            <button style={btnStyle} onClick={() => handleStatus("published")}>Re-publish</button>
          )}
        </div>
      </div>

      {/* ── Metadata ── */}
      <section style={{ background: "#fff", border: "1px solid #ddd", borderRadius: "4px", padding: "1rem 1.25rem", marginBottom: "1.5rem" }}>
        <h2 style={{ margin: "0 0 0.75rem", fontSize: "1rem" }}>Metadata</h2>
        <table style={{ borderCollapse: "collapse", width: "100%" }}>
          <tbody>
            <tr>
              <td style={thCell}>Slug</td>
              <td style={{ ...tdStyle, fontFamily: "monospace" }}>{workflow.slug}</td>
            </tr>
            <tr>
              <td style={thCell}>Description</td>
              <td style={tdStyle}>{workflow.description ?? <em style={{ color: "#888" }}>none</em>}</td>
            </tr>
            <tr>
              <td style={thCell}>Created</td>
              <td style={tdStyle}>{fmtDateTime(workflow.created_at)}</td>
            </tr>
            <tr>
              <td style={thCell}>Updated</td>
              <td style={tdStyle}>{fmtDateTime(workflow.updated_at)}</td>
            </tr>
          </tbody>
        </table>
      </section>

      {/* ── Parameter schema ── */}
      <section style={{ background: "#fff", border: "1px solid #ddd", borderRadius: "4px", padding: "1rem 1.25rem", marginBottom: "1.5rem" }}>
        <h2 style={{ margin: "0 0 0.75rem", fontSize: "1rem" }}>Parameter schema</h2>
        {Object.keys(props).length === 0 ? (
          <p style={{ color: "#888", margin: 0 }}>No parameters declared.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={thStyle}>Field</th>
                <th style={thStyle}>Type</th>
                <th style={thStyle}>Required</th>
                <th style={thStyle}>Default</th>
                <th style={thStyle}>Notes</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(props).map(([key, spec]) => (
                <tr key={key}>
                  <td style={{ ...tdStyle, fontFamily: "monospace", fontWeight: 600 }}>
                    {key}
                    {spec.title && spec.title !== key && (
                      <div style={{ fontFamily: "sans-serif", fontWeight: 400, color: "#555", fontSize: "0.8rem" }}>{spec.title}</div>
                    )}
                  </td>
                  <td style={{ ...tdStyle, fontFamily: "monospace", fontSize: "0.88rem" }}>
                    {spec.type}{spec.format ? `+${spec.format}` : ""}
                    {spec.enum && ` (${spec.enum.join(" | ")})`}
                  </td>
                  <td style={{ ...tdStyle, textAlign: "center" }}>
                    {required.has(key) ? <span style={{ color: "#b91c1c" }}>✓</span> : "—"}
                  </td>
                  <td style={{ ...tdStyle, fontFamily: "monospace", fontSize: "0.88rem" }}>
                    {spec.default !== undefined ? String(spec.default) : "—"}
                  </td>
                  <td style={{ ...tdStyle, fontSize: "0.82rem", color: "#555" }}>
                    {spec.description}
                    {spec.minimum !== undefined && ` min=${spec.minimum}`}
                    {spec.maximum !== undefined && ` max=${spec.maximum}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <details style={{ marginTop: "1rem" }}>
          <summary style={{ cursor: "pointer", fontSize: "0.85rem", color: "#555" }}>Raw JSON schema</summary>
          <pre style={{ fontSize: "0.8rem", background: "#f9f9f9", padding: "0.75rem", border: "1px solid #eee", overflow: "auto", marginTop: "0.5rem" }}>
            {JSON.stringify(workflow.param_schema, null, 2)}
          </pre>
        </details>
      </section>

      {/* ── Recent executions ── */}
      <section style={{ background: "#fff", border: "1px solid #ddd", borderRadius: "4px", padding: "1rem 1.25rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
          <h2 style={{ margin: 0, fontSize: "1rem" }}>Recent executions</h2>
          <Link to={`/executions?workflow_slug=${workflow.slug}`} style={{ fontSize: "0.85rem" }}>View all →</Link>
        </div>
        {executions.length === 0 ? (
          <p style={{ color: "#888", margin: 0 }}>No executions yet.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ ...thStyle, background: "#fafafa" }}>ID</th>
                <th style={{ ...thStyle, background: "#fafafa" }}>Status</th>
                <th style={{ ...thStyle, background: "#fafafa" }}>Started</th>
                <th style={{ ...thStyle, background: "#fafafa" }}>Duration</th>
                <th style={{ ...thStyle, background: "#fafafa" }}>Trigger</th>
                <th style={{ ...thStyle, background: "#fafafa" }}></th>
              </tr>
            </thead>
            <tbody>
              {executions.map((ex) => (
                <tr key={ex.id}>
                  <td style={{ ...tdStyle, color: "#888", fontSize: "0.85rem" }}>#{ex.id}</td>
                  <td style={tdStyle}><StatusBadge status={ex.status} /></td>
                  <td style={{ ...tdStyle, whiteSpace: "nowrap", fontSize: "0.85rem" }}>{fmtDateTime(ex.started_at)}</td>
                  <td style={{ ...tdStyle, whiteSpace: "nowrap", fontSize: "0.85rem" }}>{duration(ex.started_at, ex.finished_at)}</td>
                  <td style={{ ...tdStyle, fontSize: "0.85rem" }}>{ex.schedule_id ? `schedule #${ex.schedule_id}` : "ad hoc"}</td>
                  <td style={tdStyle}>
                    <Link to={`/executions/${ex.id}`} style={{ fontSize: "0.85rem" }}>Details →</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
