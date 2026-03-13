import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ChevronLeft,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  FileText,
} from "lucide-react";
import api from "../lib/api";
import { useToast } from "../contexts/ToastContext";
import { apiError, type Execution, type Workflow, type WorkflowStatus } from "../types";
import { Button } from "../components/ui/Button";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/Card";
import { StatusBadge } from "../components/shared/StatusBadge";
import { PageHeader } from "../components/shared/PageHeader";
import { EmptyState } from "../components/shared/EmptyState";
import { fmtDateTime, duration } from "../lib/utils";

export default function AdminWorkflowDetail() {
  const { slug } = useParams<{ slug: string }>();
  const { toast } = useToast();

  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [schemaExpanded, setSchemaExpanded] = useState(false);

  async function fetchAll() {
    if (!slug) return;
    try {
      const [wfRes, execRes] = await Promise.all([
        api.get<Workflow>(`/api/v1/workflows/${slug}`),
        api.get<Execution[]>(`/api/v1/workflows/${slug}/executions?limit=20`),
      ]);
      setWorkflow(wfRes.data);
      setExecutions(execRes.data);
    } catch (err) {
      setError(apiError(err, "Failed to load workflow."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchAll();
  }, [slug]);

  async function handleStatus(status: WorkflowStatus) {
    if (!workflow) return;
    setUpdatingStatus(true);
    try {
      const { data } = await api.patch<Workflow>(
        `/api/v1/workflows/${workflow.slug}`,
        { status }
      );
      setWorkflow(data);
      toast(`Workflow ${status}`, "success");
    } catch (err) {
      toast(apiError(err, `Failed to update status to ${status}.`), "error");
    } finally {
      setUpdatingStatus(false);
    }
  }

  function StatusActionButton() {
    if (!workflow) return null;
    if (workflow.status === "draft")
      return (
        <Button
          variant="primary"
          size="sm"
          loading={updatingStatus}
          onClick={() => handleStatus("published")}
        >
          Publish
        </Button>
      );
    if (workflow.status === "published")
      return (
        <Button
          variant="secondary"
          size="sm"
          loading={updatingStatus}
          onClick={() => handleStatus("archived")}
        >
          Archive
        </Button>
      );
    return (
      <Button
        variant="outline"
        size="sm"
        loading={updatingStatus}
        onClick={() => handleStatus("published")}
      >
        Re-publish
      </Button>
    );
  }

  // ── Loading ──────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="px-8 py-8 max-w-4xl mx-auto space-y-4">
        <div className="h-4 w-32 animate-pulse rounded bg-slate-200" />
        <div className="h-7 w-64 animate-pulse rounded bg-slate-200" />
        <div className="h-40 w-full animate-pulse rounded bg-slate-200" />
        <div className="h-64 w-full animate-pulse rounded bg-slate-200" />
      </div>
    );
  }

  if (error || !workflow) {
    return (
      <div className="px-8 py-8 max-w-4xl mx-auto">
        <Link
          to="/admin/workflows"
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 transition-colors mb-6"
        >
          <ChevronLeft className="size-4" />
          Workflow Management
        </Link>
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error ?? "Workflow not found."}
        </div>
      </div>
    );
  }

  const props = workflow.param_schema?.properties ?? {};
  const requiredSet = new Set(workflow.param_schema?.required ?? []);
  const hasParams = Object.keys(props).length > 0;

  return (
    <div className="px-8 py-8 max-w-4xl mx-auto">
      {/* Back link */}
      <Link
        to="/admin/workflows"
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 transition-colors mb-6"
      >
        <ChevronLeft className="size-4" />
        Workflow Management
      </Link>

      {/* Page header */}
      <PageHeader
        title={workflow.name}
        description={workflow.slug}
        className="mb-2"
        actions={<StatusActionButton />}
      />

      {/* Inline badges */}
      <div className="flex items-center gap-3 mb-6">
        <StatusBadge status={workflow.status} />
        {workflow.is_registered ? (
          <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
            <CheckCircle2 size={12} />
            Registered
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-xs text-amber-600">
            <AlertTriangle size={12} />
            Not in code registry
          </span>
        )}
      </div>

      <div className="space-y-4">
        {/* Section 1 — Details */}
        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-4">
              <div>
                <dt className="text-xs font-medium uppercase tracking-wider text-slate-500">
                  Slug
                </dt>
                <dd className="mt-1 font-mono text-sm text-slate-900">
                  {workflow.slug}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wider text-slate-500">
                  Registry status
                </dt>
                <dd className="mt-1 text-sm text-slate-900">
                  {workflow.is_registered ? "Registered" : "Orphaned"}
                </dd>
              </div>
              <div className="col-span-2">
                <dt className="text-xs font-medium uppercase tracking-wider text-slate-500">
                  Description
                </dt>
                <dd className="mt-1 text-sm text-slate-700">
                  {workflow.description ?? (
                    <span className="italic text-slate-400">None</span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wider text-slate-500">
                  Created at
                </dt>
                <dd className="mt-1 text-sm text-slate-700">
                  {fmtDateTime(workflow.created_at)}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wider text-slate-500">
                  Updated at
                </dt>
                <dd className="mt-1 text-sm text-slate-700">
                  {fmtDateTime(workflow.updated_at)}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        {/* Section 2 — Parameter Schema */}
        <Card>
          <CardHeader>
            <CardTitle>Parameter Schema</CardTitle>
          </CardHeader>
          <CardContent>
            {!hasParams ? (
              <EmptyState
                icon={<FileText className="size-5" />}
                title="No parameters"
                className="py-8"
              />
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50">
                      <tr>
                        {["Parameter", "Type", "Required", "Default", "Constraints"].map(
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
                      {Object.entries(props).map(([key, spec]) => {
                        const constraints: string[] = [];
                        if (spec.minimum !== undefined)
                          constraints.push(`min: ${spec.minimum}`);
                        if (spec.maximum !== undefined)
                          constraints.push(`max: ${spec.maximum}`);
                        if (spec.enum) constraints.push(spec.enum.join(", "));

                        return (
                          <tr key={key} className="hover:bg-slate-50">
                            <td className="px-4 py-3 font-mono text-sm text-slate-900">
                              {key}
                              {spec.title && spec.title !== key && (
                                <p className="mt-0.5 font-sans text-xs text-slate-500">
                                  {spec.title}
                                </p>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">
                                {spec.type}
                                {spec.format ? `+${spec.format}` : ""}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              {requiredSet.has(key) ? (
                                <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 border border-emerald-200">
                                  Yes
                                </span>
                              ) : (
                                <span className="text-xs text-slate-400">No</span>
                              )}
                            </td>
                            <td className="px-4 py-3 font-mono text-xs text-slate-600">
                              {spec.default !== undefined
                                ? String(spec.default)
                                : "—"}
                            </td>
                            <td className="px-4 py-3 text-xs text-slate-500">
                              {constraints.length > 0
                                ? constraints.join(" · ")
                                : "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Collapsible raw JSON */}
                <div className="mt-4 border-t border-slate-100 pt-4">
                  <button
                    type="button"
                    onClick={() => setSchemaExpanded((v) => !v)}
                    className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors"
                  >
                    {schemaExpanded ? (
                      <ChevronUp className="size-4" />
                    ) : (
                      <ChevronDown className="size-4" />
                    )}
                    View raw JSON
                  </button>
                  {schemaExpanded && (
                    <pre className="mt-3 overflow-x-auto rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs font-mono">
                      {JSON.stringify(workflow.param_schema, null, 2)}
                    </pre>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Section 3 — Recent Executions */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Executions</CardTitle>
            <Link
              to={`/executions?workflow=${slug}`}
              className="text-xs text-primary-600 hover:text-primary-700 transition-colors"
            >
              View all runs →
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            {executions.length === 0 ? (
              <EmptyState title="No executions yet" className="py-10" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50">
                    <tr>
                      {["ID", "Status", "Triggered", "Duration"].map((h) => (
                        <th
                          key={h}
                          className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {executions.map((ex) => (
                      <tr key={ex.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 text-xs text-slate-500">
                          <Link
                            to={`/executions/${ex.id}`}
                            className="font-mono hover:text-primary-600 transition-colors"
                          >
                            #{ex.id}
                          </Link>
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={ex.status} />
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500">
                          {fmtDateTime(ex.started_at ?? ex.created_at)}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500">
                          {duration(ex.started_at, ex.finished_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
