import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api from "../lib/api";
import { formatSize, fmtDate, fmtDateTime } from "../lib/utils";
import { apiError, type Artifact } from "../types";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <tr>
      <td style={{ padding: "0.5rem 1rem 0.5rem 0", color: "#666", fontWeight: 500, whiteSpace: "nowrap", verticalAlign: "top" }}>
        {label}
      </td>
      <td style={{ padding: "0.5rem 0", verticalAlign: "top" }}>{value || "—"}</td>
    </tr>
  );
}

function Tag({ label }: { label: string }) {
  return (
    <span style={{ background: "#e8f0fe", color: "#1a56cc", padding: "0.1rem 0.4rem", borderRadius: "3px", fontSize: "0.8rem", marginRight: "0.25rem" }}>
      {label}
    </span>
  );
}

export default function ArtifactDetail() {
  const { id } = useParams<{ id: string }>();
  const [artifact, setArtifact] = useState<Artifact | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    api
      .get<Artifact>(`/api/v1/artifacts/${id}`)
      .then(({ data }) => setArtifact(data))
      .catch((err) => setError(apiError(err, "Artifact not found.")))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div style={{ padding: "2rem" }}>Loading…</div>;

  if (error || !artifact) {
    return (
      <div style={{ padding: "2rem" }}>
        <Link to="/">← Back to artifacts</Link>
        <p style={{ color: "red", marginTop: "1rem" }}>{error ?? "Artifact not found."}</p>
      </div>
    );
  }

  const geoString = [artifact.geo_country, artifact.geo_region, artifact.geo_city, artifact.geo_label]
    .filter(Boolean)
    .join(" / ");

  return (
    <div style={{ padding: "2rem", maxWidth: 800, margin: "0 auto" }}>
      <Link to="/" style={{ color: "#555", fontSize: "0.9rem" }}>← Back to artifacts</Link>

      <h1 style={{ marginTop: "1rem", wordBreak: "break-all" }}>{artifact.filename}</h1>
      {artifact.description && (
        <p style={{ color: "#555", marginTop: 0 }}>{artifact.description}</p>
      )}

      <div style={{ background: "#fff", border: "1px solid #ddd", borderRadius: "4px", padding: "1rem 1.5rem", marginBottom: "1.5rem" }}>
        <table style={{ borderCollapse: "collapse", width: "100%" }}>
          <tbody>
            <Row label="Workflow" value={artifact.workflow_slug} />
            <Row label="Geography" value={geoString || null} />
            <Row label="Data date" value={fmtDate(artifact.data_date)} />
            <Row label="File type" value={artifact.mime_type} />
            <Row label="File size" value={artifact.file_size != null ? formatSize(artifact.file_size) : null} />
            <Row
              label="Tags"
              value={
                artifact.tags.length > 0
                  ? <>{artifact.tags.map((t) => <Tag key={t} label={t} />)}</>
                  : null
              }
            />
            <Row label="Created" value={fmtDateTime(artifact.created_at)} />
          </tbody>
        </table>
      </div>

      <a
        href={`/api/v1/artifacts/${artifact.id}/download`}
        download={artifact.filename}
        style={{
          display: "inline-block",
          padding: "0.5rem 1.25rem",
          background: "#1a56cc",
          color: "#fff",
          borderRadius: "4px",
          textDecoration: "none",
          fontWeight: 600,
        }}
      >
        ↓ Download {artifact.filename}
      </a>
    </div>
  );
}
