import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Calendar, PlayCircle, Plus } from "lucide-react";
import { cn } from "../lib/cn";
import api from "../lib/api";
import { useAuth } from "../contexts/AuthContext";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { StatusBadge } from "../components/shared/StatusBadge";
import { PageHeader } from "../components/shared/PageHeader";
import { EmptyState } from "../components/shared/EmptyState";
import { TableSkeleton } from "../components/ui/Skeleton";
import { PaginationBar } from "../components/shared/PaginationBar";
import { fmtDateTime, duration } from "../lib/utils";
import { apiError, type Execution, type ExecutionStatus } from "../types";

const LIMIT = 25;
const STATUSES: ExecutionStatus[] = ["pending", "running", "success", "failed", "cancelled"];

export default function ExecutionList() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isAdmin = user?.role === "admin";

  const [executions, setExecutions] = useState<Execution[]>([]);
  const [loading, setLoading] = useState(true);
  const [skip, setSkip] = useState(0);

  // Filters
  const [filterWorkflow, setFilterWorkflow] = useState(searchParams.get("workflow_slug") ?? "");
  const [filterStatus, setFilterStatus] = useState<ExecutionStatus | "">(
    (searchParams.get("status") as ExecutionStatus) ?? ""
  );

  async function fetchExecutions(currentSkip = skip) {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterWorkflow.trim()) params.set("workflow_slug", filterWorkflow.trim());
      if (filterStatus) params.set("status", filterStatus);
      params.set("skip", String(currentSkip));
      params.set("limit", String(LIMIT));
      const { data } = await api.get<Execution[]>(`/api/v1/executions?${params}`);
      setExecutions(data);
    } catch (err) {
      console.error(apiError(err, "Failed to load executions."));
    } finally {
      setLoading(false);
    }
  }

  // Reload when filters change — always reset to page 0
  useEffect(() => {
    setSkip(0);
    fetchExecutions(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterWorkflow, filterStatus]);

  // Reload when skip changes (pagination clicks)
  useEffect(() => {
    fetchExecutions(skip);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skip]);

  return (
    <div className="px-8 py-8">
      <PageHeader
        title={isAdmin ? "All Runs" : "Runs"}
        description="Monitor workflow execution history"
        className="mb-6"
        actions={
          <Button
            variant="primary"
            icon={<Plus className="size-4" />}
            onClick={() => navigate("/workflows")}
          >
            New Run
          </Button>
        }
      />

      {/* Filter bar */}
      <div className="flex gap-3 flex-wrap items-end mb-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-500 font-medium">Workflow</label>
          <input
            type="text"
            value={filterWorkflow}
            onChange={(e) => setFilterWorkflow(e.target.value)}
            placeholder="Filter by workflow"
            className={cn(
              "h-8 rounded border border-slate-200 bg-white px-3 text-sm text-slate-800",
              "placeholder:text-slate-400 shadow-sm focus:outline-none focus:ring-2",
              "focus:ring-primary-500 focus:border-primary-500 w-52"
            )}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-500 font-medium">Status</label>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as ExecutionStatus | "")}
            className={cn(
              "h-8 rounded border border-slate-200 bg-white px-3 text-sm text-slate-800",
              "shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500",
              "focus:border-primary-500 pr-8"
            )}
          >
            <option value="">All</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Table card */}
      <Card>
        {loading ? (
          <TableSkeleton rows={6} cols={6} />
        ) : executions.length === 0 ? (
          <EmptyState
            icon={<PlayCircle className="size-6" />}
            title="No runs yet"
            description="Trigger a workflow to see runs here"
            action={
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate("/workflows")}
              >
                Browse workflows
              </Button>
            }
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead className="bg-slate-50">
                  <tr>
                    {["ID", "Workflow", "Status", "Triggered", "Duration", "Source"].map((col) => (
                      <th
                        key={col}
                        className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500"
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {executions.map((ex) => (
                    <tr
                      key={ex.id}
                      onClick={() => navigate(`/executions/${ex.id}`)}
                      className="hover:bg-slate-50 cursor-pointer transition-colors"
                    >
                      {/* ID */}
                      <td className="px-4 py-3 text-sm">
                        <span className="font-mono text-xs text-slate-500">
                          {String(ex.id).slice(0, 8)}
                        </span>
                      </td>

                      {/* Workflow */}
                      <td className="px-4 py-3 text-sm">
                        <span className="font-mono text-xs text-slate-700">
                          {ex.workflow_slug}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3 text-sm">
                        <StatusBadge status={ex.status} />
                      </td>

                      {/* Triggered */}
                      <td className="px-4 py-3 text-sm">
                        <span className="text-xs text-slate-500">
                          {fmtDateTime(ex.created_at)}
                        </span>
                      </td>

                      {/* Duration */}
                      <td className="px-4 py-3 text-sm">
                        <span className="text-xs text-slate-500">
                          {duration(ex.started_at, ex.finished_at)}
                        </span>
                      </td>

                      {/* Source */}
                      <td className="px-4 py-3 text-sm">
                        {ex.schedule_id ? (
                          <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
                            <Calendar className="size-3.5 text-slate-400" />
                            Scheduled
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
                            <PlayCircle className="size-3.5 text-slate-400" />
                            Ad-hoc
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <PaginationBar
              skip={skip}
              limit={LIMIT}
              count={executions.length}
              onPrev={() => setSkip((s) => Math.max(0, s - LIMIT))}
              onNext={() => setSkip((s) => s + LIMIT)}
            />
          </>
        )}
      </Card>
    </div>
  );
}
