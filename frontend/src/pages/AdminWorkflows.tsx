import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, AlertTriangle, Layers } from "lucide-react";
import api from "../lib/api";
import { useToast } from "../contexts/ToastContext";
import { apiError, type Workflow, type WorkflowStatus } from "../types";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { StatusBadge } from "../components/shared/StatusBadge";
import { PageHeader } from "../components/shared/PageHeader";
import { EmptyState } from "../components/shared/EmptyState";
import { TableSkeleton } from "../components/ui/Skeleton";
import { fmtDateTime } from "../lib/utils";

export default function AdminWorkflows() {
  const { toast } = useToast();

  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingSlug, setUpdatingSlug] = useState<string | null>(null);

  async function fetchWorkflows() {
    try {
      const { data } = await api.get<Workflow[]>("/api/v1/workflows");
      setWorkflows(data);
    } catch (err) {
      toast(apiError(err, "Failed to load workflows."), "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchWorkflows();
  }, []);

  async function handleStatus(slug: string, status: WorkflowStatus) {
    setUpdatingSlug(slug);
    try {
      const { data } = await api.patch<Workflow>(`/api/v1/workflows/${slug}`, {
        status,
      });
      setWorkflows((prev) =>
        prev.map((wf) => (wf.slug === data.slug ? data : wf))
      );
      toast(`Workflow ${status}`, "success");
    } catch (err) {
      toast(apiError(err, `Failed to set workflow to ${status}.`), "error");
    } finally {
      setUpdatingSlug(null);
    }
  }

  return (
    <div className="px-8 py-8">
      <PageHeader
        title="Workflow Management"
        description="Manage workflow lifecycle and inspect definitions"
      />

      <div className="mt-6">
        <Card>
          {loading ? (
            <TableSkeleton rows={5} cols={6} />
          ) : workflows.length === 0 ? (
            <EmptyState
              icon={<Layers className="size-5" />}
              title="No workflows found"
              description="Deploy a backend with workflow modules registered."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    {["Name", "Slug", "Status", "Registry", "Updated", "Actions"].map(
                      (h) => (
                        <th
                          key={h}
                          className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500"
                        >
                          {h}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {workflows.map((wf) => (
                    <tr key={wf.slug} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <Link
                          to={`/admin/workflows/${wf.slug}`}
                          className="text-sm font-medium text-slate-900 hover:text-primary-600 transition-colors"
                        >
                          {wf.name}
                        </Link>
                        {wf.description && (
                          <p className="mt-0.5 text-xs text-slate-500 line-clamp-1">
                            {wf.description}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-600">
                          {wf.slug}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={wf.status} />
                      </td>
                      <td className="px-4 py-3">
                        {wf.is_registered ? (
                          <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
                            <CheckCircle2 size={12} />
                            Registered
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-amber-600">
                            <AlertTriangle size={12} />
                            Orphaned
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {fmtDateTime(wf.updated_at)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {wf.status === "draft" && (
                            <Button
                              variant="primary"
                              size="sm"
                              loading={updatingSlug === wf.slug}
                              onClick={() => handleStatus(wf.slug, "published")}
                            >
                              Publish
                            </Button>
                          )}
                          {wf.status === "published" && (
                            <Button
                              variant="secondary"
                              size="sm"
                              loading={updatingSlug === wf.slug}
                              onClick={() => handleStatus(wf.slug, "archived")}
                            >
                              Archive
                            </Button>
                          )}
                          {wf.status === "archived" && (
                            <Button
                              variant="outline"
                              size="sm"
                              loading={updatingSlug === wf.slug}
                              onClick={() => handleStatus(wf.slug, "published")}
                            >
                              Re-publish
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
