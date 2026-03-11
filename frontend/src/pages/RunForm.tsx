import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import api from "../lib/api";
import ParamForm, { initValues } from "../components/ParamForm";
import StatusBadge from "../components/StatusBadge";
import { apiError, type Execution, type Workflow } from "../types";

const btnStyle: React.CSSProperties = { padding: "0.4rem 1rem", cursor: "pointer", marginRight: "0.5rem" };

export default function RunForm() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [params, setParams] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    api
      .get<Workflow>(`/api/v1/workflows/${slug}`)
      .then(({ data }) => {
        setWorkflow(data);
        setParams(initValues(data.param_schema));
      })
      .catch((err) => setError(apiError(err, "Failed to load workflow.")))
      .finally(() => setLoading(false));
  }, [slug]);

  function handleParamChange(key: string, value: unknown) {
    setParams((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!workflow) return;
    setSubmitting(true);
    setError(null);
    try {
      const { data } = await api.post<Execution>("/api/v1/executions", {
        workflow_slug: workflow.slug,
        params,
      });
      navigate(`/executions/${data.id}`);
    } catch (err) {
      setError(apiError(err, "Failed to start execution."));
      setSubmitting(false);
    }
  }

  if (loading) return <div style={{ padding: "2rem" }}>Loading…</div>;

  if (!workflow) {
    return (
      <div style={{ padding: "2rem" }}>
        <Link to="/workflows">← Back to workflows</Link>
        <p style={{ color: "red", marginTop: "1rem" }}>{error ?? "Workflow not found."}</p>
      </div>
    );
  }

  return (
    <div style={{ padding: "2rem", maxWidth: 600, margin: "0 auto" }}>
      <Link to="/workflows" style={{ color: "#555", fontSize: "0.9rem" }}>← Back to workflows</Link>

      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginTop: "1rem", marginBottom: "0.25rem" }}>
        <h1 style={{ margin: 0 }}>{workflow.name}</h1>
        <StatusBadge status={workflow.status} />
      </div>
      {workflow.description && (
        <p style={{ color: "#555", marginTop: "0.25rem", marginBottom: "1.5rem" }}>{workflow.description}</p>
      )}

      {workflow.status !== "published" && (
        <p style={{ color: "#b91c1c", background: "#fde8e8", padding: "0.5rem 1rem", borderLeft: "4px solid #b91c1c", marginBottom: "1rem" }}>
          This workflow is not published and cannot be run.
        </p>
      )}

      {error && (
        <p style={{ color: "red", background: "#fff0f0", padding: "0.5rem 1rem", borderLeft: "4px solid red", marginBottom: "1rem" }}>
          {error}{" "}
          <button onClick={() => setError(null)} style={{ cursor: "pointer" }}>✕</button>
        </p>
      )}

      <form onSubmit={handleSubmit}>
        <div style={{ background: "#fff", border: "1px solid #ddd", borderRadius: "4px", padding: "1.25rem", marginBottom: "1.25rem" }}>
          <h2 style={{ margin: "0 0 1rem", fontSize: "1rem" }}>Parameters</h2>
          <ParamForm
            schema={workflow.param_schema}
            values={params}
            onChange={handleParamChange}
          />
        </div>

        <button
          type="submit"
          disabled={submitting || workflow.status !== "published"}
          style={{ ...btnStyle, background: "#1a56cc", color: "#fff", border: "none", borderRadius: "3px", padding: "0.5rem 1.25rem", fontSize: "1rem" }}
        >
          {submitting ? "Starting…" : "▶ Run now"}
        </button>
        <Link to="/workflows" style={{ color: "#555" }}>Cancel</Link>
      </form>
    </div>
  );
}
