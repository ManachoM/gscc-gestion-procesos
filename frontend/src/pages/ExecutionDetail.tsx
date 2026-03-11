import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import api from "../lib/api";
import StatusBadge from "../components/StatusBadge";
import { formatSize, fmtDateTime, duration, fmtDate } from "../lib/utils";
import { apiError, type Artifact, type ExecutionDetail, type LogEntry } from "../types";
import { useAuth } from "../contexts/AuthContext";

const tdStyle: React.CSSProperties = { padding: "0.4rem 0.75rem", borderBottom: "1px solid #eee", verticalAlign: "top" };
const thStyle: React.CSSProperties = { ...tdStyle, background: "#f5f5f5", textAlign: "left", fontWeight: 500 };
const btnStyle: React.CSSProperties = { padding: "0.3rem 0.75rem", cursor: "pointer", marginRight: "0.4rem" };

const TERMINAL = new Set(["success", "failed", "cancelled"]);

function LogLine({ entry }: { entry: LogEntry }) {
  const colors: Record<string, string> = {
    ERROR: "#b91c1c",
    WARNING: "#7d6608",
    INFO: "#222",
    DEBUG: "#888",
  };
  return (
    <div style={{ display: "flex", gap: "0.75rem", padding: "0.2rem 0", fontFamily: "monospace", fontSize: "0.82rem" }}>
      <span style={{ color: "#aaa", whiteSpace: "nowrap" }}>{fmtDateTime(entry.created_at)}</span>
      <span style={{ color: colors[entry.level] ?? "#222", width: "60px", flexShrink: 0 }}>[{entry.level}]</span>
      <span style={{ color: "#222", wordBreak: "break-word" }}>{entry.message}</span>
    </div>
  );
}

function Tag({ label }: { label: string }) {
  return (
    <span style={{ background: "#e8f0fe", color: "#1a56cc", padding: "0.1rem 0.4rem", borderRadius: "3px", fontSize: "0.75rem", marginRight: "0.25rem" }}>
      {label}
    </span>
  );
}

export default function ExecutionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [execution, setExecution] = useState<ExecutionDetail | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const intervalRef = useRef<number | undefined>(undefined);

  const fetchAll = useCallback(async () => {
    if (!id) return;
    try {
      const [execRes, logsRes, artRes] = await Promise.all([
        api.get<ExecutionDetail>(`/api/v1/executions/${id}`),
        api.get<LogEntry[]>(`/api/v1/executions/${id}/logs`),
        api.get<Artifact[]>(`/api/v1/executions/${id}/artifacts`),
      ]);
      setExecution(execRes.data);
      setLogs(logsRes.data);
      setArtifacts(artRes.data);
    } catch (err) {
      setError(apiError(err, "Failed to load execution."));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Poll every 5 s while execution is in a non-terminal state
  useEffect(() => {
    if (!execution) return;
    if (TERMINAL.has(execution.status)) {
      clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = setInterval(fetchAll, 5000);
    return () => clearInterval(intervalRef.current);
  }, [execution?.status, fetchAll]);

  async function handleCancel() {
    if (!id || !window.confirm("Cancel this execution?")) return;
    setCancelling(true);
    try {
      await api.post(`/api/v1/executions/${id}/cancel`);
      await fetchAll();
    } catch (err) {
      setError(apiError(err, "Failed to cancel execution."));
    } finally {
      setCancelling(false);
    }
  }

  if (loading) return <div style={{ padding: "2rem" }}>Loading…</div>;

  if (error || !execution) {
    return (
      <div style={{ padding: "2rem" }}>
        <Link to="/executions">← Back to runs</Link>
        <p style={{ color: "red", marginTop: "1rem" }}>{error ?? "Execution not found."}</p>
      </div>
    );
  }

  const isActive = !TERMINAL.has(execution.status);

  return (
    <div style={{ padding: "2rem", maxWidth: 1000, margin: "0 auto" }}>
      <Link to="/executions" style={{ color: "#555", fontSize: "0.9rem" }}>← Back to runs</Link>

      <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginTop: "1rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
        <h1 style={{ margin: 0 }}>Run #{execution.id}</h1>
        <StatusBadge status={execution.status} />
        {isActive && (
          <span style={{ color: "#1a56cc", fontSize: "0.85rem" }}>⟳ auto-refreshing…</span>
        )}
        <div style={{ marginLeft: "auto", display: "flex", gap: "0.5rem" }}>
          <button style={btnStyle} onClick={fetchAll}>Refresh</button>
          {isActive && (
            <button
              style={{ ...btnStyle, color: "#b91c1c" }}
              onClick={handleCancel}
              disabled={cancelling}
            >
              {cancelling ? "Cancelling…" : "Cancel"}
            </button>
          )}
          {execution.status === "failed" && (
            <button
              style={{ ...btnStyle }}
              onClick={() => navigate(`/workflows/${execution.workflow_slug}/run`)}
            >
              Retry (new run)
            </button>
          )}
        </div>
      </div>

      {/* ── Summary ── */}
      <section style={{ background: "#fff", border: "1px solid #ddd", borderRadius: "4px", padding: "1rem 1.25rem", marginBottom: "1.5rem" }}>
        <h2 style={{ margin: "0 0 0.75rem", fontSize: "1rem" }}>Summary</h2>
        <table style={{ borderCollapse: "collapse", width: "100%" }}>
          <tbody>
            <tr>
              <td style={{ ...thStyle, width: "140px" }}>Workflow</td>
              <td style={tdStyle}>{execution.workflow_slug}</td>
            </tr>
            <tr>
              <td style={thStyle}>Triggered</td>
              <td style={tdStyle}>{fmtDateTime(execution.created_at)}{execution.schedule_id ? ` (schedule #${execution.schedule_id})` : " (ad hoc)"}</td>
            </tr>
            <tr>
              <td style={thStyle}>Started</td>
              <td style={tdStyle}>{fmtDateTime(execution.started_at)}</td>
            </tr>
            <tr>
              <td style={thStyle}>Finished</td>
              <td style={tdStyle}>{fmtDateTime(execution.finished_at)}</td>
            </tr>
            <tr>
              <td style={thStyle}>Duration</td>
              <td style={tdStyle}>{duration(execution.started_at, execution.finished_at)}</td>
            </tr>
          </tbody>
        </table>
      </section>

      {/* ── Parameters ── */}
      {Object.keys(execution.params).length > 0 && (
        <section style={{ background: "#fff", border: "1px solid #ddd", borderRadius: "4px", padding: "1rem 1.25rem", marginBottom: "1.5rem" }}>
          <h2 style={{ margin: "0 0 0.75rem", fontSize: "1rem" }}>Parameters</h2>
          <table style={{ borderCollapse: "collapse" }}>
            <tbody>
              {Object.entries(execution.params).map(([k, v]) => (
                <tr key={k}>
                  <td style={{ ...thStyle, width: "160px" }}>{k}</td>
                  <td style={{ ...tdStyle, fontFamily: "monospace", fontSize: "0.9rem" }}>{String(v)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* ── Error ── */}
      {execution.status === "failed" && execution.error_message && (
        <section style={{ background: "#fde8e8", border: "1px solid #f0b0b0", borderRadius: "4px", padding: "1rem 1.25rem", marginBottom: "1.5rem" }}>
          <h2 style={{ margin: "0 0 0.5rem", fontSize: "1rem", color: "#b91c1c" }}>Error</h2>
          <p style={{ margin: 0, fontFamily: "monospace", fontSize: "0.9rem" }}>{execution.error_message}</p>
          {isAdmin && execution.error_traceback && (
            <details style={{ marginTop: "0.75rem" }}>
              <summary style={{ cursor: "pointer", fontSize: "0.85rem", color: "#555" }}>Traceback (admin only)</summary>
              <pre style={{ margin: "0.5rem 0 0", fontSize: "0.8rem", overflow: "auto", background: "#fff8f8", padding: "0.75rem", border: "1px solid #f0b0b0" }}>
                {execution.error_traceback}
              </pre>
            </details>
          )}
        </section>
      )}

      {/* ── Artifacts ── */}
      <section style={{ background: "#fff", border: "1px solid #ddd", borderRadius: "4px", padding: "1rem 1.25rem", marginBottom: "1.5rem" }}>
        <h2 style={{ margin: "0 0 0.75rem", fontSize: "1rem" }}>
          Artifacts {artifacts.length > 0 && <span style={{ color: "#888", fontWeight: 400 }}>({artifacts.length})</span>}
        </h2>
        {artifacts.length === 0 ? (
          <p style={{ color: "#888", margin: 0 }}>
            {isActive ? "No artifacts yet — run is still in progress." : "No artifacts produced."}
          </p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ ...thStyle, background: "#fafafa" }}>Filename</th>
                <th style={{ ...thStyle, background: "#fafafa" }}>Geography</th>
                <th style={{ ...thStyle, background: "#fafafa" }}>Data date</th>
                <th style={{ ...thStyle, background: "#fafafa" }}>Tags</th>
                <th style={{ ...thStyle, background: "#fafafa" }}>Size</th>
                <th style={{ ...thStyle, background: "#fafafa" }}>Download</th>
              </tr>
            </thead>
            <tbody>
              {artifacts.map((a) => (
                <tr key={a.id}>
                  <td style={tdStyle}>
                    <Link to={`/artifacts/${a.id}`}>{a.filename}</Link>
                  </td>
                  <td style={{ ...tdStyle, fontSize: "0.85rem" }}>
                    {[a.geo_country, a.geo_region, a.geo_city].filter(Boolean).join(" / ") || "—"}
                  </td>
                  <td style={{ ...tdStyle, fontSize: "0.85rem", whiteSpace: "nowrap" }}>{fmtDate(a.data_date)}</td>
                  <td style={tdStyle}>{a.tags.map((t) => <Tag key={t} label={t} />)}</td>
                  <td style={{ ...tdStyle, whiteSpace: "nowrap", fontSize: "0.85rem" }}>
                    {a.file_size != null ? formatSize(a.file_size) : "—"}
                  </td>
                  <td style={tdStyle}>
                    {a.is_public ? (
                      <a href={`/api/v1/artifacts/${a.id}/download`} download={a.filename}>↓ Download</a>
                    ) : (
                      <span style={{ color: "#aaa", fontSize: "0.85rem" }}>not public yet</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* ── Logs ── */}
      <section style={{ background: "#fff", border: "1px solid #ddd", borderRadius: "4px", padding: "1rem 1.25rem" }}>
        <h2 style={{ margin: "0 0 0.75rem", fontSize: "1rem" }}>
          Logs {logs.length > 0 && <span style={{ color: "#888", fontWeight: 400 }}>({logs.length} entries)</span>}
        </h2>
        {logs.length === 0 ? (
          <p style={{ color: "#888", margin: 0 }}>No log entries.</p>
        ) : (
          <div style={{ background: "#f9f9f9", border: "1px solid #eee", borderRadius: "3px", padding: "0.75rem 1rem", maxHeight: "400px", overflowY: "auto" }}>
            {logs.map((entry) => <LogLine key={entry.id} entry={entry} />)}
          </div>
        )}
      </section>
    </div>
  );
}
