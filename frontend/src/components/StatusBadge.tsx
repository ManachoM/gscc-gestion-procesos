import type { ExecutionStatus, WorkflowStatus } from "../types";

type AnyStatus = WorkflowStatus | ExecutionStatus;

const COLORS: Record<AnyStatus, { bg: string; color: string }> = {
  // Workflow lifecycle
  draft:     { bg: "#f0f0f0", color: "#666" },
  published: { bg: "#e6f4ea", color: "#1a6e2a" },
  archived:  { bg: "#f0f0f0", color: "#999" },
  // Execution lifecycle
  pending:   { bg: "#fef9e7", color: "#7d6608" },
  running:   { bg: "#e8f0fe", color: "#1a56cc" },
  success:   { bg: "#e6f4ea", color: "#1a6e2a" },
  failed:    { bg: "#fde8e8", color: "#b91c1c" },
  cancelled: { bg: "#f0f0f0", color: "#888" },
};

interface Props {
  status: AnyStatus;
}

export default function StatusBadge({ status }: Props) {
  const { bg, color } = COLORS[status] ?? { bg: "#f0f0f0", color: "#555" };
  return (
    <span
      style={{
        background: bg,
        color,
        padding: "0.15rem 0.5rem",
        borderRadius: "0.25rem",
        fontSize: "0.82rem",
        fontWeight: 600,
        letterSpacing: "0.02em",
        whiteSpace: "nowrap",
      }}
    >
      {status}
    </span>
  );
}
