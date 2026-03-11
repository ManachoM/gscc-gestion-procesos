import { FormEvent, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import api from "../lib/api";
import StatusBadge from "../components/StatusBadge";
import { fmtDateTime, duration } from "../lib/utils";
import { apiError, type Execution, type ExecutionStatus } from "../types";
import { useAuth } from "../contexts/AuthContext";

const thStyle: React.CSSProperties = { padding: "0.5rem 0.75rem", background: "#f5f5f5", textAlign: "left", borderBottom: "1px solid #ddd", whiteSpace: "nowrap" };
const tdStyle: React.CSSProperties = { padding: "0.5rem 0.75rem", borderBottom: "1px solid #eee", verticalAlign: "top" };
const inputStyle: React.CSSProperties = { padding: "0.3rem 0.5rem", border: "1px solid #ccc", borderRadius: "3px" };
const btnStyle: React.CSSProperties = { padding: "0.3rem 0.75rem", cursor: "pointer", marginRight: "0.4rem" };
const LIMIT = 50;

const STATUSES: ExecutionStatus[] = ["pending", "running", "success", "failed", "cancelled"];

export default function ExecutionList() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [skip, setSkip] = useState(0);

  // Filters
  const [filterWorkflow, setFilterWorkflow] = useState(searchParams.get("workflow_slug") ?? "");
  const [filterStatus, setFilterStatus] = useState<ExecutionStatus | "">("");

  async function fetchExecutions(currentSkip = skip) {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filterWorkflow.trim()) params.set("workflow_slug", filterWorkflow.trim());
      if (filterStatus) params.set("status", filterStatus);
      params.set("skip", String(currentSkip));
      params.set("limit", String(LIMIT));
      const { data } = await api.get<Execution[]>(`/api/v1/executions?${params}`);
      setExecutions(data);
    } catch (err) {
      setError(apiError(err, "Failed to load executions."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchExecutions(skip);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skip]);

  function handleFilter(e: FormEvent) {
    e.preventDefault();
    const newSkip = 0;
    setSkip(newSkip);
    fetchExecutions(newSkip);
  }

  return (
    <div style={{ padding: "2rem", maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <h1 style={{ margin: 0 }}>
          {user?.role === "admin" ? "All Runs" : "My Runs"}
        </h1>
        <Link
          to="/workflows"
          style={{ padding: "0.4rem 0.9rem", background: "#1a56cc", color: "#fff", borderRadius: "3px", textDecoration: "none", fontSize: "0.9rem" }}
        >
          + New Run
        </Link>
      </div>

      {/* Filter bar */}
      <form onSubmit={handleFilter} style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginBottom: "1rem", flexWrap: "wrap" }}>
        <input
          style={inputStyle}
          value={filterWorkflow}
          onChange={(e) => setFilterWorkflow(e.target.value)}
          placeholder="Workflow slug"
        />
        <select style={inputStyle} value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as ExecutionStatus | "")}>
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <button style={btnStyle} type="submit">Filter</button>
        <button style={btnStyle} type="button" onClick={() => { setFilterWorkflow(""); setFilterStatus(""); setSkip(0); fetchExecutions(0); }}>
          Clear
        </button>
      </form>

      {error && (
        <p style={{ color: "red", background: "#fff0f0", padding: "0.5rem 1rem", borderLeft: "4px solid red", marginBottom: "1rem" }}>
          {error}
        </p>
      )}

      {loading ? (
        <p style={{ color: "#888" }}>Loading…</p>
      ) : (
        <>
          <table style={{ width: "100%", borderCollapse: "collapse", background: "#fff" }}>
            <thead>
              <tr>
                <th style={thStyle}>ID</th>
                <th style={thStyle}>Workflow</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Started</th>
                <th style={thStyle}>Duration</th>
                <th style={thStyle}>Triggered</th>
                <th style={thStyle}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {executions.map((ex) => (
                <tr key={ex.id}>
                  <td style={{ ...tdStyle, color: "#888", fontSize: "0.85rem" }}>#{ex.id}</td>
                  <td style={tdStyle}>{ex.workflow_slug}</td>
                  <td style={{ ...tdStyle, whiteSpace: "nowrap" }}>
                    <StatusBadge status={ex.status} />
                  </td>
                  <td style={{ ...tdStyle, whiteSpace: "nowrap", fontSize: "0.85rem" }}>{fmtDateTime(ex.started_at)}</td>
                  <td style={{ ...tdStyle, whiteSpace: "nowrap", fontSize: "0.85rem" }}>{duration(ex.started_at, ex.finished_at)}</td>
                  <td style={{ ...tdStyle, fontSize: "0.85rem" }}>
                    {ex.schedule_id ? `schedule #${ex.schedule_id}` : "ad hoc"}
                  </td>
                  <td style={tdStyle}>
                    <Link to={`/executions/${ex.id}`} style={{ fontSize: "0.9rem" }}>Details →</Link>
                  </td>
                </tr>
              ))}
              {executions.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: "2.5rem", color: "#888" }}>
                    No runs found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginTop: "1rem" }}>
            <button style={btnStyle} disabled={skip === 0} onClick={() => setSkip((s) => Math.max(0, s - LIMIT))}>
              ← Prev
            </button>
            <span style={{ color: "#888", fontSize: "0.9rem" }}>{skip + 1}–{skip + executions.length}</span>
            <button style={btnStyle} disabled={executions.length < LIMIT} onClick={() => setSkip((s) => s + LIMIT)}>
              Next →
            </button>
          </div>
        </>
      )}
    </div>
  );
}
