import { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../lib/api";
import { formatSize, fmtDate } from "../lib/utils";
import { apiError, type Artifact } from "../types";

const inputStyle: React.CSSProperties = {
  padding: "0.3rem 0.5rem",
  width: "100%",
  boxSizing: "border-box",
  border: "1px solid #ccc",
  borderRadius: "3px",
};
const btnStyle: React.CSSProperties = { padding: "0.35rem 0.75rem", marginRight: "0.4rem", cursor: "pointer" };
const thStyle: React.CSSProperties = { padding: "0.5rem 0.75rem", background: "#f5f5f5", textAlign: "left", borderBottom: "1px solid #ddd", whiteSpace: "nowrap" };
const tdStyle: React.CSSProperties = { padding: "0.5rem 0.75rem", borderBottom: "1px solid #eee", verticalAlign: "top" };
const LIMIT = 50;

function Tag({ label }: { label: string }) {
  return (
    <span style={{ background: "#e8f0fe", color: "#1a56cc", padding: "0.1rem 0.4rem", borderRadius: "3px", fontSize: "0.75rem", marginRight: "0.25rem", whiteSpace: "nowrap" }}>
      {label}
    </span>
  );
}

function geo(a: Artifact): string {
  return [a.geo_country, a.geo_region, a.geo_city].filter(Boolean).join(" / ") || "—";
}

export default function ArtifactBrowser() {
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [skip, setSkip] = useState(0);

  // Filter state
  const [workflowSlug, setWorkflowSlug] = useState("");
  const [country, setCountry] = useState("");
  const [region, setRegion] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [tags, setTags] = useState("");
  const [q, setQ] = useState("");

  async function fetchArtifacts(currentSkip = skip) {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (workflowSlug.trim()) params.set("workflow_slug", workflowSlug.trim());
      if (country.trim()) params.set("country", country.trim());
      if (region.trim()) params.set("region", region.trim());
      if (dateFrom) params.set("date_from", dateFrom);
      if (dateTo) params.set("date_to", dateTo);
      tags.split(",").map((t) => t.trim()).filter(Boolean).forEach((t) => params.append("tags", t));
      if (q.trim()) params.set("q", q.trim());
      params.set("skip", String(currentSkip));
      params.set("limit", String(LIMIT));
      const { data } = await api.get<Artifact[]>(`/api/v1/artifacts?${params}`);
      setArtifacts(data);
    } catch (err) {
      setError(apiError(err, "Failed to load artifacts."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchArtifacts(skip);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skip]);

  function handleSearch(e: FormEvent) {
    e.preventDefault();
    const newSkip = 0;
    setSkip(newSkip);
    fetchArtifacts(newSkip);
  }

  function handleClear() {
    setWorkflowSlug(""); setCountry(""); setRegion("");
    setDateFrom(""); setDateTo(""); setTags(""); setQ("");
    setSkip(0);
  }

  return (
    <div style={{ padding: "2rem", maxWidth: 1200, margin: "0 auto" }}>
      <h1 style={{ marginTop: 0 }}>Public Artifacts</h1>
      <p style={{ color: "#666", marginBottom: "1.5rem" }}>
        Browse and download publicly available data files produced by extraction workflows.
      </p>

      {/* ── Search form ── */}
      <form
        onSubmit={handleSearch}
        style={{ background: "#f9f9f9", border: "1px solid #ddd", borderRadius: "4px", padding: "1rem 1.25rem", marginBottom: "1.5rem" }}
      >
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "0.75rem", marginBottom: "0.75rem" }}>
          <label>
            <span style={{ display: "block", fontSize: "0.8rem", fontWeight: 500, marginBottom: "0.2rem" }}>Workflow</span>
            <input style={inputStyle} value={workflowSlug} onChange={(e) => setWorkflowSlug(e.target.value)} placeholder="e.g. sample_extraction" />
          </label>
          <label>
            <span style={{ display: "block", fontSize: "0.8rem", fontWeight: 500, marginBottom: "0.2rem" }}>Country</span>
            <input style={inputStyle} value={country} onChange={(e) => setCountry(e.target.value)} />
          </label>
          <label>
            <span style={{ display: "block", fontSize: "0.8rem", fontWeight: 500, marginBottom: "0.2rem" }}>Region</span>
            <input style={inputStyle} value={region} onChange={(e) => setRegion(e.target.value)} />
          </label>
          <label>
            <span style={{ display: "block", fontSize: "0.8rem", fontWeight: 500, marginBottom: "0.2rem" }}>Data from</span>
            <input style={inputStyle} type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </label>
          <label>
            <span style={{ display: "block", fontSize: "0.8rem", fontWeight: 500, marginBottom: "0.2rem" }}>Data to</span>
            <input style={inputStyle} type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </label>
          <label>
            <span style={{ display: "block", fontSize: "0.8rem", fontWeight: 500, marginBottom: "0.2rem" }}>Tags (comma-separated)</span>
            <input style={inputStyle} value={tags} onChange={(e) => setTags(e.target.value)} placeholder="tag1, tag2" />
          </label>
          <label>
            <span style={{ display: "block", fontSize: "0.8rem", fontWeight: 500, marginBottom: "0.2rem" }}>Search</span>
            <input style={inputStyle} value={q} onChange={(e) => setQ(e.target.value)} placeholder="filename or description" />
          </label>
        </div>
        <button style={btnStyle} type="submit">Search</button>
        <button style={btnStyle} type="button" onClick={handleClear}>Clear</button>
      </form>

      {/* ── Error ── */}
      {error && (
        <p style={{ color: "red", background: "#fff0f0", padding: "0.5rem 1rem", borderLeft: "4px solid red", marginBottom: "1rem" }}>
          {error}{" "}
          <button onClick={() => setError(null)} style={{ cursor: "pointer" }}>✕</button>
        </p>
      )}

      {/* ── Results ── */}
      {loading ? (
        <p style={{ color: "#888" }}>Loading…</p>
      ) : (
        <>
          <table style={{ width: "100%", borderCollapse: "collapse", background: "#fff" }}>
            <thead>
              <tr>
                <th style={thStyle}>File</th>
                <th style={thStyle}>Workflow</th>
                <th style={thStyle}>Geography</th>
                <th style={thStyle}>Data date</th>
                <th style={thStyle}>Tags</th>
                <th style={thStyle}>Size</th>
                <th style={thStyle}>Download</th>
              </tr>
            </thead>
            <tbody>
              {artifacts.map((a) => (
                <tr key={a.id}>
                  <td style={tdStyle}>
                    <Link to={`/artifacts/${a.id}`} style={{ fontWeight: 500 }}>{a.filename}</Link>
                    {a.description && (
                      <div style={{ fontSize: "0.8rem", color: "#888", marginTop: "0.2rem" }}>{a.description}</div>
                    )}
                  </td>
                  <td style={tdStyle}>{a.workflow_slug}</td>
                  <td style={{ ...tdStyle, whiteSpace: "nowrap" }}>{geo(a)}</td>
                  <td style={{ ...tdStyle, whiteSpace: "nowrap" }}>{fmtDate(a.data_date)}</td>
                  <td style={tdStyle}>{a.tags.map((t) => <Tag key={t} label={t} />)}</td>
                  <td style={{ ...tdStyle, whiteSpace: "nowrap" }}>{a.file_size != null ? formatSize(a.file_size) : "—"}</td>
                  <td style={tdStyle}>
                    <a
                      href={`/api/v1/artifacts/${a.id}/download`}
                      download={a.filename}
                      style={{ whiteSpace: "nowrap" }}
                    >
                      ↓ Download
                    </a>
                  </td>
                </tr>
              ))}
              {artifacts.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: "2.5rem", color: "#888" }}>
                    No public artifacts found. Try adjusting your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {/* ── Pagination ── */}
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginTop: "1rem" }}>
            <button style={btnStyle} disabled={skip === 0} onClick={() => setSkip((s) => Math.max(0, s - LIMIT))}>
              ← Prev
            </button>
            <span style={{ color: "#888", fontSize: "0.9rem" }}>
              {skip + 1}–{skip + artifacts.length}
            </span>
            <button style={btnStyle} disabled={artifacts.length < LIMIT} onClick={() => setSkip((s) => s + LIMIT)}>
              Next →
            </button>
          </div>
        </>
      )}
    </div>
  );
}
