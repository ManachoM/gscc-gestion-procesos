import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../lib/api";
import ParamForm, { initValues } from "../components/ParamForm";
import { apiError, type Schedule, type ScheduleType, type Workflow } from "../types";

const inputStyle: React.CSSProperties = {
  padding: "0.35rem 0.5rem",
  width: "100%",
  boxSizing: "border-box",
  border: "1px solid #ccc",
  borderRadius: "3px",
  fontSize: "0.95rem",
};
const labelStyle: React.CSSProperties = { display: "block", marginBottom: "0.25rem", fontWeight: 500, fontSize: "0.9rem" };
const fieldStyle: React.CSSProperties = { marginBottom: "1rem" };
const btnStyle: React.CSSProperties = { padding: "0.4rem 1rem", cursor: "pointer", marginRight: "0.5rem" };

export default function ScheduleForm() {
  const navigate = useNavigate();

  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [selectedSlug, setSelectedSlug] = useState("");
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null);
  const [params, setParams] = useState<Record<string, unknown>>({});

  const [name, setName] = useState("");
  const [scheduleType, setScheduleType] = useState<ScheduleType>("once");
  const [cronExpr, setCronExpr] = useState("");
  const [runAt, setRunAt] = useState("");

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<Workflow[]>("/api/v1/workflows")
      .then(({ data }) => setWorkflows(data.filter((wf) => wf.status === "published")))
      .catch((err) => setError(apiError(err, "Failed to load workflows.")))
      .finally(() => setLoading(false));
  }, []);

  function handleWorkflowChange(slug: string) {
    setSelectedSlug(slug);
    const wf = workflows.find((w) => w.slug === slug) ?? null;
    setSelectedWorkflow(wf);
    setParams(wf ? initValues(wf.param_schema) : {});
  }

  function handleParamChange(key: string, value: unknown) {
    setParams((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!selectedSlug) { setError("Please select a workflow."); return; }

    setSubmitting(true);
    setError(null);

    const body: Record<string, unknown> = {
      workflow_slug: selectedSlug,
      params,
      name: name.trim() || null,
      schedule_type: scheduleType,
    };

    if (scheduleType === "recurring") {
      body.cron_expr = cronExpr.trim();
    } else {
      // Convert datetime-local string to ISO with timezone
      body.run_at = runAt ? new Date(runAt).toISOString() : null;
    }

    try {
      const { data } = await api.post<Schedule>("/api/v1/schedules", body);
      navigate(data.schedule_type === "once" ? "/executions" : "/schedules");
    } catch (err) {
      setError(apiError(err, "Failed to create schedule."));
      setSubmitting(false);
    }
  }

  return (
    <div style={{ padding: "2rem", maxWidth: 600, margin: "0 auto" }}>
      <Link to="/schedules" style={{ color: "#555", fontSize: "0.9rem" }}>← Back to schedules</Link>
      <h1 style={{ marginTop: "1rem", marginBottom: "1.5rem" }}>New Schedule</h1>

      {error && (
        <p style={{ color: "red", background: "#fff0f0", padding: "0.5rem 1rem", borderLeft: "4px solid red", marginBottom: "1rem" }}>
          {error}{" "}
          <button onClick={() => setError(null)} style={{ cursor: "pointer" }}>✕</button>
        </p>
      )}

      {loading ? (
        <p style={{ color: "#888" }}>Loading workflows…</p>
      ) : (
        <form onSubmit={handleSubmit}>
          {/* ── Workflow selection ── */}
          <div style={{ background: "#fff", border: "1px solid #ddd", borderRadius: "4px", padding: "1.25rem", marginBottom: "1rem" }}>
            <h2 style={{ margin: "0 0 1rem", fontSize: "1rem" }}>Workflow</h2>
            <div style={fieldStyle}>
              <label style={labelStyle}>
                Workflow <span style={{ color: "#b91c1c" }}>*</span>
              </label>
              <select
                style={inputStyle}
                value={selectedSlug}
                onChange={(e) => handleWorkflowChange(e.target.value)}
                required
              >
                <option value="">— Select a published workflow —</option>
                {workflows.map((wf) => (
                  <option key={wf.slug} value={wf.slug}>{wf.name} ({wf.slug})</option>
                ))}
              </select>
              {workflows.length === 0 && (
                <p style={{ color: "#888", fontSize: "0.85rem", margin: "0.3rem 0 0" }}>
                  No published workflows available.
                </p>
              )}
            </div>

            {selectedWorkflow?.description && (
              <p style={{ margin: "0 0 0.5rem", color: "#555", fontSize: "0.85rem" }}>{selectedWorkflow.description}</p>
            )}
          </div>

          {/* ── Parameters ── */}
          {selectedWorkflow && (
            <div style={{ background: "#fff", border: "1px solid #ddd", borderRadius: "4px", padding: "1.25rem", marginBottom: "1rem" }}>
              <h2 style={{ margin: "0 0 1rem", fontSize: "1rem" }}>Parameters</h2>
              <ParamForm
                schema={selectedWorkflow.param_schema}
                values={params}
                onChange={handleParamChange}
              />
            </div>
          )}

          {/* ── Schedule settings ── */}
          <div style={{ background: "#fff", border: "1px solid #ddd", borderRadius: "4px", padding: "1.25rem", marginBottom: "1.25rem" }}>
            <h2 style={{ margin: "0 0 1rem", fontSize: "1rem" }}>Schedule settings</h2>

            <div style={fieldStyle}>
              <label style={labelStyle}>Name (optional)</label>
              <input
                style={inputStyle}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Weekly north extraction"
              />
            </div>

            <div style={fieldStyle}>
              <label style={labelStyle}>Type <span style={{ color: "#b91c1c" }}>*</span></label>
              <div style={{ display: "flex", gap: "1.5rem" }}>
                <label style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: "0.35rem" }}>
                  <input
                    type="radio"
                    name="schedule_type"
                    value="once"
                    checked={scheduleType === "once"}
                    onChange={() => setScheduleType("once")}
                  />
                  One-off (run once at a specific time)
                </label>
                <label style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: "0.35rem" }}>
                  <input
                    type="radio"
                    name="schedule_type"
                    value="recurring"
                    checked={scheduleType === "recurring"}
                    onChange={() => setScheduleType("recurring")}
                  />
                  Recurring (cron)
                </label>
              </div>
            </div>

            {scheduleType === "once" && (
              <div style={fieldStyle}>
                <label style={labelStyle}>Run at <span style={{ color: "#b91c1c" }}>*</span></label>
                <input
                  style={inputStyle}
                  type="datetime-local"
                  value={runAt}
                  onChange={(e) => setRunAt(e.target.value)}
                  required
                />
                <p style={{ fontSize: "0.78rem", color: "#888", margin: "0.2rem 0 0" }}>
                  Time is interpreted in your local timezone.
                </p>
              </div>
            )}

            {scheduleType === "recurring" && (
              <div style={fieldStyle}>
                <label style={labelStyle}>Cron expression <span style={{ color: "#b91c1c" }}>*</span></label>
                <input
                  style={{ ...inputStyle, fontFamily: "monospace" }}
                  value={cronExpr}
                  onChange={(e) => setCronExpr(e.target.value)}
                  placeholder="0 8 * * 1"
                  required
                />
                <p style={{ fontSize: "0.78rem", color: "#888", margin: "0.2rem 0 0" }}>
                  Standard 5-field UTC cron: <code>minute hour day-of-month month day-of-week</code>
                  <br />Examples: <code>0 8 * * 1</code> (Mon 8 AM) · <code>0 */6 * * *</code> (every 6 h) · <code>30 9 1 * *</code> (1st of month)
                </p>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={submitting || !selectedSlug}
            style={{
              ...btnStyle,
              background: "#1a56cc",
              color: "#fff",
              border: "none",
              borderRadius: "3px",
              padding: "0.5rem 1.25rem",
              fontSize: "1rem",
            }}
          >
            {submitting ? "Creating…" : "Create schedule"}
          </button>
          <Link to="/schedules" style={{ color: "#555" }}>Cancel</Link>
        </form>
      )}
    </div>
  );
}
