import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Download, Package, Search, X } from "lucide-react";
import api from "../lib/api";
import { cn } from "../lib/cn";
import { formatSize, fmtDate } from "../lib/utils";
import { apiError, type Artifact } from "../types";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { TableSkeleton } from "../components/ui/Skeleton";
import { PageHeader } from "../components/shared/PageHeader";
import { EmptyState } from "../components/shared/EmptyState";
import { PaginationBar } from "../components/shared/PaginationBar";

const LIMIT = 50;

function geoLabel(a: Artifact): string {
  if (a.geo_label) return a.geo_label;
  return [a.geo_country, a.geo_region, a.geo_city].filter(Boolean).join(" · ") || "—";
}

function TagPill({ label }: { label: string }) {
  return (
    <span className="inline-block rounded-full bg-slate-100 text-slate-600 px-2 py-0.5 text-xs whitespace-nowrap">
      {label}
    </span>
  );
}

export default function ArtifactBrowser() {
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [skip, setSkip] = useState(0);

  // Filter state
  const [q, setQ] = useState("");
  const [workflowSlug, setWorkflowSlug] = useState("");
  const [country, setCountry] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [tags, setTags] = useState("");

  const hasActiveFilter =
    q.trim() !== "" ||
    workflowSlug.trim() !== "" ||
    country.trim() !== "" ||
    dateFrom !== "" ||
    dateTo !== "" ||
    tags.trim() !== "";

  interface Filters {
    q: string;
    workflowSlug: string;
    country: string;
    dateFrom: string;
    dateTo: string;
    tags: string;
  }

  async function fetchArtifacts(currentSkip: number, filters: Filters) {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filters.q.trim()) params.set("q", filters.q.trim());
      if (filters.workflowSlug.trim()) params.set("workflow_slug", filters.workflowSlug.trim());
      if (filters.country.trim()) params.set("country", filters.country.trim());
      if (filters.dateFrom) params.set("date_from", filters.dateFrom);
      if (filters.dateTo) params.set("date_to", filters.dateTo);
      const tagList = filters.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      if (tagList.length > 0) params.set("tags", tagList.join(","));
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

  const currentFilters: Filters = { q, workflowSlug, country, dateFrom, dateTo, tags };

  useEffect(() => {
    fetchArtifacts(skip, currentFilters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skip]);

  function handleFilterChange() {
    setSkip(0);
    fetchArtifacts(0, currentFilters);
  }

  function handleClear() {
    const cleared: Filters = { q: "", workflowSlug: "", country: "", dateFrom: "", dateTo: "", tags: "" };
    setQ("");
    setWorkflowSlug("");
    setCountry("");
    setDateFrom("");
    setDateTo("");
    setTags("");
    setSkip(0);
    fetchArtifacts(0, cleared);
  }

  const inputCls =
    "h-9 border border-slate-200 rounded px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white text-slate-900 placeholder:text-slate-400";

  return (
    <div className="px-8 py-8 max-w-7xl mx-auto">
      <PageHeader
        title="Artifact Catalog"
        description="Browse and download published geospatial data files"
      />

      {/* Filter bar */}
      <div className="mt-6 flex flex-wrap gap-3 items-end">
        {/* Search */}
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none" />
          <input
            className={cn(inputCls, "pl-8 w-full")}
            placeholder="Search files…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleFilterChange()}
          />
        </div>

        {/* Workflow slug */}
        <input
          className={inputCls}
          placeholder="Workflow slug"
          value={workflowSlug}
          onChange={(e) => setWorkflowSlug(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleFilterChange()}
        />

        {/* Country */}
        <input
          className={inputCls}
          placeholder="Country"
          value={country}
          onChange={(e) => setCountry(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleFilterChange()}
        />

        {/* Date from */}
        <input
          type="date"
          className={inputCls}
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
        />

        {/* Date to */}
        <input
          type="date"
          className={inputCls}
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
        />

        {/* Tags */}
        <input
          className={inputCls}
          placeholder="Tags (comma-sep)"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleFilterChange()}
        />

        <Button variant="secondary" size="sm" onClick={handleFilterChange}>
          Search
        </Button>

        {hasActiveFilter && (
          <Button
            variant="ghost"
            size="sm"
            icon={<X className="size-3.5" />}
            onClick={handleClear}
          >
            Clear
          </Button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="mt-4 flex items-center gap-2 rounded border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
          <span className="flex-1">{error}</span>
          <button
            onClick={() => setError(null)}
            className="text-red-400 hover:text-red-600"
            aria-label="Dismiss"
          >
            <X className="size-4" />
          </button>
        </div>
      )}

      {/* Results count */}
      {!loading && !error && (
        <p className="mt-4 text-sm text-slate-500">
          Showing {artifacts.length} result{artifacts.length !== 1 ? "s" : ""}
        </p>
      )}

      {/* Results table */}
      <Card className="mt-2 overflow-hidden">
        {loading ? (
          <TableSkeleton rows={8} cols={7} />
        ) : artifacts.length === 0 ? (
          <EmptyState
            icon={<Package className="size-6" />}
            title="No artifacts found"
            description="Try adjusting your filters to find what you're looking for."
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead className="bg-slate-50">
                  <tr>
                    {["Filename", "Workflow", "Geography", "Data date", "Tags", "Size", "Download"].map(
                      (col) => (
                        <th
                          key={col}
                          className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap"
                        >
                          {col}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {artifacts.map((a) => (
                    <tr key={a.id} className="hover:bg-slate-50">
                      {/* Filename */}
                      <td className="px-4 py-3 text-sm">
                        <Link
                          to={`/artifacts/${a.id}`}
                          className="font-medium text-slate-900 font-mono hover:text-primary-600 hover:underline"
                        >
                          {a.filename}
                        </Link>
                        {a.description && (
                          <p className="mt-0.5 text-xs text-slate-400 font-sans max-w-xs truncate">
                            {a.description}
                          </p>
                        )}
                      </td>

                      {/* Workflow */}
                      <td className="px-4 py-3">
                        <span className="text-xs text-slate-500 font-mono">{a.workflow_slug}</span>
                      </td>

                      {/* Geography */}
                      <td className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap">
                        {geoLabel(a)}
                      </td>

                      {/* Data date */}
                      <td className="px-4 py-3 text-sm text-slate-700 whitespace-nowrap">
                        {fmtDate(a.data_date)}
                      </td>

                      {/* Tags */}
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {a.tags.length > 0
                            ? a.tags.map((t) => <TagPill key={t} label={t} />)
                            : <span className="text-xs text-slate-400">—</span>}
                        </div>
                      </td>

                      {/* Size */}
                      <td className="px-4 py-3 text-sm text-slate-500 whitespace-nowrap">
                        {a.file_size != null ? formatSize(a.file_size) : "—"}
                      </td>

                      {/* Download */}
                      <td className="px-4 py-3">
                        <a
                          href={`/api/v1/artifacts/${a.id}/download`}
                          download={a.filename}
                          className={cn(
                            "inline-flex items-center justify-center gap-1.5 rounded font-medium transition-colors",
                            "h-8 px-3 text-xs",
                            "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                          )}
                        >
                          <Download className="size-3.5" />
                          Download
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <PaginationBar
              skip={skip}
              limit={LIMIT}
              count={artifacts.length}
              onPrev={() => setSkip((s) => Math.max(0, s - LIMIT))}
              onNext={() => setSkip((s) => s + LIMIT)}
            />
          </>
        )}
      </Card>
    </div>
  );
}
