import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../lib/api";
import { fmtDateTime } from "../lib/utils";
import { apiError, type Schedule } from "../types";
import { useAuth } from "../contexts/AuthContext";

const thStyle: React.CSSProperties = { padding: "0.5rem 0.75rem", background: "#f5f5f5", textAlign: "left", borderBottom: "1px solid #ddd", whiteSpace: "nowrap" };
const tdStyle: React.CSSProperties = { padding: "0.5rem 0.75rem", borderBottom: "1px solid #eee", verticalAlign: "top" };
const btnStyle: React.CSSProperties = { padding: "0.25rem 0.6rem", cursor: "pointer", marginRight: "0.3rem", fontSize: "0.85rem" };

function ActiveBadge({ active }: { active: boolean }) {
  return (
    <span style={{
      background: active ? "#e6f4ea" : "#f0f0f0",
      color: active ? "#1a6e2a" : "#888",
      padding: "0.15rem 0.5rem",
      borderRadius: "3px",
      fontSize: "0.8rem",
      fontWeight: 600,
    }}>
      {active ? "active" : "inactive"}
    </span>
  );
}

export default function ScheduleList() {
  const { user } = useAuth();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function fetchSchedules() {
    try {
      const { data } = await api.get<Schedule[]>("/api/v1/schedules");
      setSchedules(data);
    } catch (err) {
      setError(apiError(err, "Failed to load schedules."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchSchedules(); }, []);

  async function handleToggle(s: Schedule) {
    try {
      await api.patch(`/api/v1/schedules/${s.id}`, { is_active: !s.is_active });
      await fetchSchedules();
    } catch (err) {
      setError(apiError(err, "Failed to update schedule."));
    }
  }

  async function handleDelete(s: Schedule) {
    if (!window.confirm(`Deactivate schedule "${s.name ?? `#${s.id}`}"?`)) return;
    try {
      await api.delete(`/api/v1/schedules/${s.id}`);
      await fetchSchedules();
    } catch (err) {
      setError(apiError(err, "Failed to deactivate schedule."));
    }
  }

  return (
    <div style={{ padding: "2rem", maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <h1 style={{ margin: 0 }}>
          {user?.role === "admin" ? "All Schedules" : "My Schedules"}
        </h1>
        <Link
          to="/schedules/new"
          style={{ padding: "0.4rem 0.9rem", background: "#1a56cc", color: "#fff", borderRadius: "3px", textDecoration: "none", fontSize: "0.9rem" }}
        >
          + New Schedule
        </Link>
      </div>

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
              <th style={thStyle}>Name / Workflow</th>
              <th style={thStyle}>Type</th>
              <th style={thStyle}>Schedule</th>
              <th style={thStyle}>Next run</th>
              <th style={thStyle}>Last run</th>
              <th style={thStyle}>Status</th>
              <th style={thStyle}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {schedules.map((s) => (
              <tr key={s.id}>
                <td style={tdStyle}>
                  <div style={{ fontWeight: 500 }}>{s.name ?? <em style={{ color: "#888" }}>unnamed</em>}</div>
                  <div style={{ color: "#888", fontSize: "0.8rem" }}>{s.workflow_slug}</div>
                </td>
                <td style={{ ...tdStyle, whiteSpace: "nowrap" }}>{s.schedule_type}</td>
                <td style={{ ...tdStyle, fontFamily: "monospace", fontSize: "0.85rem" }}>
                  {s.schedule_type === "recurring" ? s.cron_expr : fmtDateTime(s.run_at)}
                </td>
                <td style={{ ...tdStyle, whiteSpace: "nowrap", fontSize: "0.85rem" }}>{fmtDateTime(s.next_run_at)}</td>
                <td style={{ ...tdStyle, whiteSpace: "nowrap", fontSize: "0.85rem" }}>{fmtDateTime(s.last_run_at)}</td>
                <td style={tdStyle}><ActiveBadge active={s.is_active} /></td>
                <td style={{ ...tdStyle, whiteSpace: "nowrap" }}>
                  <button style={btnStyle} onClick={() => handleToggle(s)}>
                    {s.is_active ? "Pause" : "Resume"}
                  </button>
                  <button style={{ ...btnStyle, color: "#b91c1c" }} onClick={() => handleDelete(s)}>
                    Deactivate
                  </button>
                </td>
              </tr>
            ))}
            {schedules.length === 0 && (
              <tr>
                <td colSpan={7} style={{ textAlign: "center", padding: "2.5rem", color: "#888" }}>
                  No schedules. <Link to="/schedules/new">Create one →</Link>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
