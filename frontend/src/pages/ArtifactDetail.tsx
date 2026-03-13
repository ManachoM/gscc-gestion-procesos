import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ChevronLeft, Download, FileX } from "lucide-react";
import api from "../lib/api";
import { cn } from "../lib/cn";
import { formatSize, fmtDate, fmtDateTime } from "../lib/utils";
import { apiError, type Artifact } from "../types";
import { Button } from "../components/ui/Button";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/Card";
import { Skeleton } from "../components/ui/Skeleton";
import { PageHeader } from "../components/shared/PageHeader";
import { EmptyState } from "../components/shared/EmptyState";

function DetailItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</dt>
      <dd className="mt-0.5 text-sm text-slate-900 break-all">{value ?? "—"}</dd>
    </div>
  );
}

function TagPill({ label }: { label: string }) {
  return (
    <span className="inline-block rounded-full bg-slate-100 text-slate-600 px-2 py-0.5 text-xs">
      {label}
    </span>
  );
}

function DetailSkeleton() {
  return (
    <div className="px-6 py-8 max-w-3xl mx-auto space-y-6">
      <Skeleton className="h-4 w-32" />
      <div className="space-y-2">
        <Skeleton className="h-7 w-96" />
        <Skeleton className="h-4 w-48" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-xl border border-slate-200 p-5 space-y-3">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        ))}
      </div>
    </div>
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

  if (loading) return <DetailSkeleton />;

  if (error || !artifact) {
    return (
      <div className="px-6 py-8 max-w-3xl mx-auto">
        <Link
          to="/artifacts"
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-4"
        >
          <ChevronLeft className="size-4" />
          Back to Artifacts
        </Link>
        <EmptyState
          icon={<FileX className="size-6" />}
          title="Artifact not found"
          description={error ?? "This artifact does not exist or is not publicly available."}
          action={
            <Link to="/artifacts">
              <Button variant="secondary" size="sm">
                Back to catalog
              </Button>
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="px-6 py-8 max-w-3xl mx-auto">
      {/* Back link */}
      <Link
        to="/artifacts"
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-4"
      >
        <ChevronLeft className="size-4" />
        Back to Artifacts
      </Link>

      {/* Page header */}
      <PageHeader
        title={artifact.filename}
        description={artifact.description ?? undefined}
        actions={
          <a
            href={`/api/v1/artifacts/${artifact.id}/download`}
            download={artifact.filename}
            className={cn(
              "inline-flex items-center justify-center gap-2 rounded font-medium transition-colors",
              "h-9 px-4 text-sm",
              "bg-primary-600 text-white hover:bg-primary-700 shadow-sm"
            )}
          >
            <Download className="size-4" />
            Download
          </a>
        }
      />

      {/* Three-column info grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
        {/* File card */}
        <Card>
          <CardHeader>
            <CardTitle>File</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-1 gap-y-3">
              <DetailItem
                label="Size"
                value={artifact.file_size != null ? formatSize(artifact.file_size) : "—"}
              />
              <DetailItem
                label="MIME type"
                value={
                  artifact.mime_type ? (
                    <span className="font-mono text-xs">{artifact.mime_type}</span>
                  ) : (
                    "—"
                  )
                }
              />
            </dl>
          </CardContent>
        </Card>

        {/* Provenance card */}
        <Card>
          <CardHeader>
            <CardTitle>Provenance</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-1 gap-y-3">
              <DetailItem
                label="Workflow"
                value={<span className="font-mono text-xs">{artifact.workflow_slug}</span>}
              />
              <DetailItem
                label="Execution"
                value={
                  <Link
                    to={`/executions/${artifact.execution_id}`}
                    className="font-mono text-xs text-primary-600 hover:underline"
                  >
                    #{artifact.execution_id}
                  </Link>
                }
              />
            </dl>
          </CardContent>
        </Card>

        {/* Geography card */}
        <Card>
          <CardHeader>
            <CardTitle>Geography</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-1 gap-y-3">
              <DetailItem label="Country" value={artifact.geo_country} />
              <DetailItem label="Region" value={artifact.geo_region} />
              <DetailItem label="City" value={artifact.geo_city} />
              <DetailItem label="Label" value={artifact.geo_label} />
            </dl>
          </CardContent>
        </Card>
      </div>

      {/* Tags */}
      {artifact.tags.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Tags</p>
          <div className="flex flex-wrap gap-1.5">
            {artifact.tags.map((t) => (
              <TagPill key={t} label={t} />
            ))}
          </div>
        </div>
      )}

      {/* Metadata row */}
      <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
        <div>
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">
            Data date
          </span>
          <p className="mt-0.5 text-sm text-slate-900">{fmtDate(artifact.data_date)}</p>
        </div>
        <div>
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">
            Created at
          </span>
          <p className="mt-0.5 text-sm text-slate-900">{fmtDateTime(artifact.created_at)}</p>
        </div>
      </div>
    </div>
  );
}
