import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  AlertCircle,
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  Download,
  Loader2,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { cn } from "../lib/cn";
import api from "../lib/api";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import { Button } from "../components/ui/Button";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/Card";
import { StatusBadge } from "../components/shared/StatusBadge";
import { EmptyState } from "../components/shared/EmptyState";
import { ConfirmDialog } from "../components/ui/Dialog";
import { Skeleton } from "../components/ui/Skeleton";
import { formatSize, fmtDateTime, duration, fmtDate } from "../lib/utils";
import { apiError, type Artifact, type ExecutionDetail, type LogEntry } from "../types";

const TERMINAL = new Set(["success", "failed", "cancelled"]);

// ── Log line ────────────────────────────────────────────────────────────────

const levelStyles: Record<string, string> = {
  ERROR: "text-red-400",
  WARNING: "text-amber-400",
  INFO: "text-blue-400",
  DEBUG: "text-slate-500",
};

function LogLine({ entry }: { entry: LogEntry }) {
  const levelClass = levelStyles[entry.level] ?? "text-slate-400";
  const isError = entry.level === "ERROR";
  return (
    <div className="flex gap-3">
      <span className="text-slate-500 text-[11px] shrink-0 whitespace-nowrap">
        {fmtDateTime(entry.created_at)}
      </span>
      <span
        className={cn(
          "text-[10px] font-bold uppercase w-14 text-center shrink-0",
          levelClass
        )}
      >
        {entry.level}
      </span>
      <span className={cn("text-xs break-words", isError ? "text-red-400" : "text-slate-300")}>
        {entry.message}
      </span>
    </div>
  );
}

// ── Tag chip ────────────────────────────────────────────────────────────────

function TagChip({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center rounded-full bg-primary-50 px-2 py-0.5 text-[11px] font-medium text-primary-700 border border-primary-100">
      {label}
    </span>
  );
}

// ── Main component ──────────────────────────────────────────────────────────

export default function ExecutionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { toast } = useToast();
  const isAdmin = user?.role === "admin";

  const [execution, setExecution] = useState<ExecutionDetail | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showTraceback, setShowTraceback] = useState(false);

  const intervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const prevLogsLen = useRef(0);

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchAll = useCallback(async () => {
    if (!id) return;
    try {
      const [execRes, logsRes, artRes] = await Promise.all([
        api.get<ExecutionDetail>(`/api/v1/executions/${id}`),
        api.get<LogEntry[]>(`/api/v1/executions/${id}/logs`),
        api.get<Artifact[]>(`/api/v1/executions/${id}/artifacts`),
      ]);
      setExecution(execRes.data);
      setLogs(logsRes.data);
      setArtifacts(artRes.data);
    } catch (err) {
      toast(apiError(err, "Failed to load execution."), "error");
    } finally {
      setLoading(false);
    }
  }, [id, toast]);

  // Initial load
  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Auto-scroll logs to bottom when new entries arrive
  useEffect(() => {
    if (logs.length > prevLogsLen.current) {
      logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
    prevLogsLen.current = logs.length;
  }, [logs.length]);

  // Auto-refresh every 5 s while non-terminal
  useEffect(() => {
    if (!execution) return;
    if (TERMINAL.has(execution.status)) {
      clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = setInterval(fetchAll, 5000);
    return () => clearInterval(intervalRef.current);
  }, [execution?.status, fetchAll]);

  // ── Cancel ─────────────────────────────────────────────────────────────────

  async function handleCancel() {
    if (!id) return;
    setCancelling(true);
    try {
      await api.post(`/api/v1/executions/${id}/cancel`);
      toast("Execution cancelled.", "success");
      await fetchAll();
    } catch (err) {
      toast(apiError(err, "Failed to cancel execution."), "error");
    } finally {
      setCancelling(false);
      setShowCancelDialog(false);
    }
  }

  // ── Loading / error states ─────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="px-8 py-8 space-y-4">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
      </div>
    );
  }

  if (!execution) {
    return (
      <div className="px-8 py-8">
        <Link
          to="/executions"
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 transition-colors mb-6"
        >
          <ChevronLeft className="size-4" />
          All runs
        </Link>
        <p className="text-sm text-red-600">Execution not found.</p>
      </div>
    );
  }

  const isActive = !TERMINAL.has(execution.status);
  return (
    <div className="px-8 py-8 space-y-5">

      {/* ── Back link ─────────────────────────────────────────────────────── */}
      <Link
        to="/executions"
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 transition-colors"
      >
        <ChevronLeft className="size-4" />
        All runs
      </Link>

      {/* ── Header card ───────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-6">
        {/* Top row */}
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-mono text-lg font-medium text-slate-900">
            #{execution.id}
          </span>
          <StatusBadge
            status={execution.status}
            pulse={isActive}
            className="text-sm px-3 py-1"
          />

          {isActive && (
            <span className="inline-flex items-center gap-1.5 text-xs text-slate-400 ml-1">
              <Loader2 className="size-3.5 animate-spin" />
              Refreshing every 5s
            </span>
          )}

          {/* Right-side actions */}
          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              icon={<RefreshCw className="size-3.5" />}
              onClick={fetchAll}
            >
              Refresh
            </Button>
            {isActive && (
              <Button
                variant="danger"
                size="sm"
                icon={<XCircle className="size-3.5" />}
                onClick={() => setShowCancelDialog(true)}
              >
                Cancel
              </Button>
            )}
          </div>
        </div>

        {/* Workflow slug */}
        <p className="mt-2 font-mono text-sm text-slate-500">{execution.workflow_slug}</p>

        {/* Info strip */}
        <dl className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 pt-4 border-t border-slate-100">
          {[
            { label: "Triggered at", value: fmtDateTime(execution.created_at) },
            { label: "Started at", value: fmtDateTime(execution.started_at) },
            { label: "Finished at", value: fmtDateTime(execution.finished_at) },
            {
              label: "Duration",
              value: duration(execution.started_at, execution.finished_at),
            },
            { label: "Triggered by", value: String(execution.triggered_by) },
            {
              label: "Source",
              value: execution.schedule_id ? "Scheduled" : "Ad-hoc",
            },
          ].map(({ label, value }) => (
            <div key={label}>
              <dt className="text-xs text-slate-500 uppercase tracking-wide">{label}</dt>
              <dd className="text-sm text-slate-900 mt-0.5">{value}</dd>
            </div>
          ))}
        </dl>
      </div>

      {/* ── Parameters ───────────────────────────────────────────────────── */}
      {Object.keys(execution.params).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Parameters</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {Object.entries(execution.params).map(([k, v]) => (
                <div key={k}>
                  <dt className="text-xs text-slate-500">{k}</dt>
                  <dd className="text-sm font-mono text-slate-900 mt-0.5 break-all">
                    {String(v)}
                  </dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
      )}

      {/* ── Error ────────────────────────────────────────────────────────── */}
      {execution.status === "failed" && execution.error_message && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="size-5 text-red-500 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-red-800">Execution failed</p>
              <p className="mt-1 text-sm text-red-700 break-words">{execution.error_message}</p>

              {isAdmin && execution.error_traceback && (
                <div className="mt-3">
                  <button
                    onClick={() => setShowTraceback((v) => !v)}
                    className="inline-flex items-center gap-1 text-xs text-red-600 hover:text-red-800 transition-colors font-medium"
                  >
                    {showTraceback ? (
                      <>
                        <ChevronUp className="size-3.5" />
                        Hide traceback
                      </>
                    ) : (
                      <>
                        <ChevronDown className="size-3.5" />
                        Show traceback
                      </>
                    )}
                  </button>
                  {showTraceback && (
                    <pre className="mt-3 text-xs font-mono text-red-700 overflow-x-auto whitespace-pre-wrap bg-red-100/50 rounded p-3">
                      {execution.error_traceback}
                    </pre>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Artifacts ────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>
            Output files
            {artifacts.length > 0 && (
              <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                {artifacts.length}
              </span>
            )}
          </CardTitle>
        </CardHeader>

        {artifacts.length === 0 ? (
          <EmptyState
            icon={<Download className="size-5" />}
            title="No output files"
            description={isActive ? "Files will appear here once the run completes." : "This run produced no artifacts."}
            className="py-10"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead className="bg-slate-50">
                <tr>
                  {["Filename", "Geography", "Data date", "Tags", "Size", "Download"].map((col) => (
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
                {artifacts.map((a) => {
                  const geo = [a.geo_label, a.geo_country, a.geo_region, a.geo_city]
                    .filter(Boolean)
                    .join(" / ");
                  return (
                    <tr key={a.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 text-sm">
                        <span className="font-mono text-xs text-slate-700 font-medium">
                          {a.filename}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-500">
                        {geo || "—"}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-500 whitespace-nowrap">
                        {fmtDate(a.data_date)}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <div className="flex flex-wrap gap-1">
                          {a.tags.length > 0
                            ? a.tags.map((t) => <TagChip key={t} label={t} />)
                            : <span className="text-slate-400 text-xs">—</span>
                          }
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-500 whitespace-nowrap">
                        {a.file_size != null ? formatSize(a.file_size) : "—"}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {a.is_public ? (
                          <a
                            href={`/api/v1/artifacts/${a.id}/download`}
                            download={a.filename}
                          >
                            <Button
                              variant="ghost"
                              size="sm"
                              icon={<Download className="size-3.5" />}
                              onClick={(e) => e.stopPropagation()}
                            >
                              Download
                            </Button>
                          </a>
                        ) : (
                          <span className="text-slate-400 italic text-xs">Processing…</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* ── Logs ─────────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>
            Execution logs
            {logs.length > 0 && (
              <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                {logs.length}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 pb-4">
          <div className="max-h-96 overflow-y-auto bg-slate-950 rounded-lg mx-4 p-4 font-mono text-xs leading-relaxed">
            {logs.length === 0 ? (
              <p className="text-slate-600 text-center py-8 text-sm">No logs yet</p>
            ) : (
              <div className="space-y-1">
                {logs.map((entry) => (
                  <LogLine key={entry.id} entry={entry} />
                ))}
                <div ref={logsEndRef} />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Cancel confirm dialog ─────────────────────────────────────────── */}
      <ConfirmDialog
        open={showCancelDialog}
        onClose={() => setShowCancelDialog(false)}
        onConfirm={handleCancel}
        title="Cancel execution?"
        description="This will send a cancellation signal to the running task. The task may take a moment to stop."
        confirmLabel="Cancel execution"
        variant="danger"
        loading={cancelling}
      />
    </div>
  );
}
