// ── Enums (mirror backend models) ────────────────────────────────────────────

export type WorkflowStatus = "draft" | "published" | "archived";
export type ScheduleType = "once" | "recurring";
export type ExecutionStatus = "pending" | "running" | "success" | "failed" | "cancelled";
export type LogLevel = "DEBUG" | "INFO" | "WARNING" | "ERROR";

// ── JSON Schema (subset used by param forms) ──────────────────────────────────

export interface JsonSchemaProperty {
  type?: string;
  title?: string;
  description?: string;
  format?: string;
  enum?: string[];
  default?: unknown;
  minimum?: number;
  maximum?: number;
}

export interface JsonSchema {
  type?: string;
  title?: string;
  properties?: Record<string, JsonSchemaProperty>;
  required?: string[];
}

// ── Domain types (mirror backend Pydantic schemas) ────────────────────────────

export interface Workflow {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  status: WorkflowStatus;
  param_schema: JsonSchema;
  is_registered: boolean;
  created_at: string;
  updated_at: string;
}

export interface Schedule {
  id: number;
  workflow_id: number;
  workflow_slug: string;
  created_by: number;
  name: string | null;
  params: Record<string, unknown>;
  param_fingerprint: string;
  schedule_type: ScheduleType;
  cron_expr: string | null;
  run_at: string | null;
  is_active: boolean;
  next_run_at: string | null;
  last_run_at: string | null;
  created_at: string;
}

export interface Execution {
  id: number;
  workflow_id: number;
  workflow_slug: string;
  schedule_id: number | null;
  triggered_by: number;
  params: Record<string, unknown>;
  param_fingerprint: string;
  celery_task_id: string | null;
  status: ExecutionStatus;
  started_at: string | null;
  finished_at: string | null;
  error_message: string | null;
  created_at: string;
}

export interface ExecutionDetail extends Execution {
  error_traceback: string | null;
}

export interface LogEntry {
  id: number;
  level: LogLevel;
  message: string;
  created_at: string;
}

export interface Artifact {
  id: number;
  execution_id: number;
  workflow_id: number;
  workflow_slug: string;
  filename: string;
  file_size: number | null;
  mime_type: string | null;
  /** True once the parent execution succeeded and the artifact was published. */
  is_public: boolean;
  geo_country: string | null;
  geo_region: string | null;
  geo_city: string | null;
  geo_label: string | null;
  data_date: string | null;
  tags: string[];
  description: string | null;
  created_at: string;
}

// ── Shared error helper ───────────────────────────────────────────────────────

type ApiErrorShape = { response?: { data?: { detail?: string } } };

export function apiError(err: unknown, fallback: string): string {
  return (err as ApiErrorShape)?.response?.data?.detail ?? fallback;
}
