import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus,
  Calendar,
  RefreshCw,
  PauseCircle,
  PlayCircle,
  Trash2,
} from "lucide-react";
import api from "../lib/api";
import { useToast } from "../contexts/ToastContext";
import { type Schedule, apiError } from "../types";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { StatusBadge } from "../components/shared/StatusBadge";
import { PageHeader } from "../components/shared/PageHeader";
import { EmptyState } from "../components/shared/EmptyState";
import { TableSkeleton } from "../components/ui/Skeleton";
import { ConfirmDialog } from "../components/ui/Dialog";
import { fmtDateTime } from "../lib/utils";
import cronstrue from "cronstrue";

function cronHuman(expr: string): string {
  try {
    return cronstrue.toString(expr);
  } catch {
    return expr;
  }
}

export default function ScheduleList() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Schedule | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    api
      .get<Schedule[]>("/api/v1/schedules", { params: { limit: 100 } })
      .then(({ data }) => setSchedules(data))
      .catch(() => toast("Failed to load schedules", "error"))
      .finally(() => setLoading(false));
  }, []);

  async function handleToggle(schedule: Schedule) {
    setTogglingId(schedule.id);
    try {
      const { data } = await api.patch<Schedule>(
        `/api/v1/schedules/${schedule.id}`,
        { is_active: !schedule.is_active }
      );
      setSchedules((prev) => prev.map((s) => (s.id === data.id ? data : s)));
      toast(data.is_active ? "Schedule resumed" : "Schedule paused", "success");
    } catch (err) {
      toast(apiError(err, "Failed to update schedule"), "error");
    } finally {
      setTogglingId(null);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/api/v1/schedules/${deleteTarget.id}`);
      setSchedules((prev) => prev.filter((s) => s.id !== deleteTarget.id));
      toast("Schedule deactivated", "success");
      setDeleteTarget(null);
    } catch (err) {
      toast(apiError(err, "Failed to deactivate schedule"), "error");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="px-8 py-8">
      <PageHeader
        title="Schedules"
        description="Manage scheduled workflow executions"
        actions={
          <Button
            variant="primary"
            icon={<Plus className="size-3.5" />}
            onClick={() => navigate("/schedules/new")}
          >
            New Schedule
          </Button>
        }
      />

      <div className="mt-6">
        <Card>
          {loading ? (
            <TableSkeleton rows={5} cols={8} />
          ) : schedules.length === 0 ? (
            <EmptyState
              icon={<Calendar className="size-5" />}
              title="No schedules yet"
              description="Create your first schedule to automate workflow runs"
              action={
                <Button
                  variant="primary"
                  size="sm"
                  icon={<Plus className="size-3.5" />}
                  onClick={() => navigate("/schedules/new")}
                >
                  New Schedule
                </Button>
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    {[
                      "Name",
                      "Workflow",
                      "Type",
                      "Schedule",
                      "Next run",
                      "Last run",
                      "Status",
                      "Actions",
                    ].map((h) => (
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
                  {schedules.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-sm text-slate-900">
                        {s.name ?? (
                          <span className="italic text-slate-400">Unnamed</span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-600">
                        {s.workflow_slug}
                      </td>
                      <td className="px-4 py-3">
                        {s.schedule_type === "once" ? (
                          <span className="inline-flex items-center gap-1.5 text-xs text-slate-600">
                            <Calendar className="size-3.5 shrink-0" />
                            One-time
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-xs text-slate-600">
                            <RefreshCw className="size-3.5 shrink-0" />
                            Recurring
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700">
                        {s.schedule_type === "once" ? (
                          <span className="text-xs">{fmtDateTime(s.run_at)}</span>
                        ) : s.cron_expr ? (
                          <span
                            className="font-mono text-xs text-slate-600"
                            title={cronHuman(s.cron_expr)}
                          >
                            {s.cron_expr}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {fmtDateTime(s.next_run_at)}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {fmtDateTime(s.last_run_at)}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge
                          status={s.is_active ? "active" : "inactive"}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            loading={togglingId === s.id}
                            icon={
                              s.is_active ? (
                                <PauseCircle className="size-3.5" />
                              ) : (
                                <PlayCircle className="size-3.5" />
                              )
                            }
                            onClick={() => handleToggle(s)}
                          >
                            {s.is_active ? "Pause" : "Resume"}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-500 hover:text-red-600"
                            icon={<Trash2 className="size-3.5" />}
                            onClick={() => setDeleteTarget(s)}
                          >
                            Deactivate
                          </Button>
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

      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Deactivate schedule"
        description="This will stop future runs."
        confirmLabel="Deactivate"
        variant="danger"
        loading={deleting}
      />
    </div>
  );
}
