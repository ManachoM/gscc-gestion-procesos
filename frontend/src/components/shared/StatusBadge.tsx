import { cn } from "../../lib/cn";
import { ExecutionStatus, WorkflowStatus } from "../../types";

type AnyStatus = ExecutionStatus | WorkflowStatus | "active" | "inactive" | string;

const statusConfig: Record<
  string,
  { label: string; className: string; dot?: string }
> = {
  // Execution statuses
  pending: {
    label: "Pending",
    className: "bg-amber-50 text-amber-700 border-amber-200",
    dot: "bg-amber-400",
  },
  running: {
    label: "Running",
    className: "bg-blue-50 text-blue-700 border-blue-200",
    dot: "bg-blue-500",
  },
  success: {
    label: "Success",
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
    dot: "bg-emerald-500",
  },
  failed: {
    label: "Failed",
    className: "bg-red-50 text-red-700 border-red-200",
    dot: "bg-red-500",
  },
  cancelled: {
    label: "Cancelled",
    className: "bg-slate-100 text-slate-500 border-slate-200",
    dot: "bg-slate-400",
  },
  // Workflow statuses
  draft: {
    label: "Draft",
    className: "bg-slate-100 text-slate-600 border-slate-200",
    dot: "bg-slate-400",
  },
  published: {
    label: "Published",
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
    dot: "bg-emerald-500",
  },
  archived: {
    label: "Archived",
    className: "bg-slate-100 text-slate-400 border-slate-200",
    dot: "bg-slate-300",
  },
  // Schedule statuses
  active: {
    label: "Active",
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
    dot: "bg-emerald-500",
  },
  inactive: {
    label: "Inactive",
    className: "bg-slate-100 text-slate-400 border-slate-200",
    dot: "bg-slate-300",
  },
};

interface StatusBadgeProps {
  status: AnyStatus;
  className?: string;
  pulse?: boolean;
}

export function StatusBadge({ status, className, pulse }: StatusBadgeProps) {
  const config = statusConfig[status] ?? {
    label: status,
    className: "bg-slate-100 text-slate-600 border-slate-200",
    dot: "bg-slate-400",
  };

  const isRunning = status === "running" || status === "pending";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        config.className,
        className
      )}
    >
      <span className="relative flex size-1.5">
        {(pulse || isRunning) && (
          <span
            className={cn(
              "absolute inline-flex h-full w-full animate-ping rounded-full opacity-75",
              config.dot
            )}
          />
        )}
        <span className={cn("relative inline-flex size-1.5 rounded-full", config.dot)} />
      </span>
      {config.label}
    </span>
  );
}
