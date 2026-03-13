import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ChevronLeft, Clock, RefreshCw } from "lucide-react";
import cronstrue from "cronstrue";
import api from "../lib/api";
import { useToast } from "../contexts/ToastContext";
import { apiError, type Schedule, type ScheduleType, type Workflow, type JsonSchema, type JsonSchemaProperty } from "../types";
import { cn } from "../lib/cn";
import { Button } from "../components/ui/Button";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/Card";
import { Input, Select } from "../components/ui/Input";
import { PageHeader } from "../components/shared/PageHeader";

// ── helpers ───────────────────────────────────────────────────────────────────

function initValues(schema: JsonSchema): Record<string, unknown> {
  const props = schema.properties ?? {};
  return Object.fromEntries(
    Object.entries(props).map(([key, spec]) => [key, spec.default ?? ""])
  );
}

function cronHuman(expr: string): string {
  if (!expr.trim()) return "";
  try {
    return cronstrue.toString(expr);
  } catch {
    return "Invalid expression";
  }
}

// ── ParamField ────────────────────────────────────────────────────────────────

interface ParamFieldProps {
  fieldKey: string;
  spec: JsonSchemaProperty;
  value: unknown;
  isRequired: boolean;
  onChange: (key: string, value: unknown) => void;
}

function ParamField({ fieldKey, spec, value, isRequired, onChange }: ParamFieldProps) {
  const label = spec.title ?? fieldKey;
  const rawValue = value ?? spec.default ?? "";

  if (spec.enum && spec.enum.length > 0) {
    return (
      <Select
        label={label}
        helper={spec.description}
        required={isRequired}
        value={String(rawValue)}
        onChange={(e) => onChange(fieldKey, e.target.value)}
        options={[
          { value: "", label: "— Select —" },
          ...spec.enum.map((v) => ({ value: v, label: v })),
        ]}
      />
    );
  }

  if (spec.type === "boolean") {
    return (
      <div className="flex flex-col gap-1.5">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={Boolean(rawValue)}
            onChange={(e) => onChange(fieldKey, e.target.checked)}
            className="size-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
          />
          <span className="text-sm font-medium text-slate-700">
            {label}
            {isRequired && <span className="ml-1 text-red-500">*</span>}
          </span>
        </label>
        {spec.description && (
          <p className="text-xs text-slate-500 ml-6">{spec.description}</p>
        )}
      </div>
    );
  }

  if (spec.type === "integer" || spec.type === "number") {
    const helperParts: string[] = [];
    if (spec.description) helperParts.push(spec.description);
    if (spec.minimum !== undefined) helperParts.push(`Min: ${spec.minimum}`);
    if (spec.maximum !== undefined) helperParts.push(`Max: ${spec.maximum}`);
    return (
      <Input
        label={label}
        type="number"
        required={isRequired}
        value={rawValue === "" ? "" : String(rawValue)}
        min={spec.minimum}
        max={spec.maximum}
        helper={helperParts.join(" · ") || undefined}
        onChange={(e) =>
          onChange(fieldKey, e.target.value === "" ? "" : Number(e.target.value))
        }
      />
    );
  }

  if (spec.type === "string" && spec.format === "date") {
    return (
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-slate-700">
          {label}
          {isRequired && <span className="ml-1 text-red-500">*</span>}
        </label>
        <input
          type="date"
          required={isRequired}
          value={String(rawValue)}
          onChange={(e) => onChange(fieldKey, e.target.value)}
          className="h-9 w-full rounded border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />
        {spec.description && (
          <p className="text-xs text-slate-500">{spec.description}</p>
        )}
      </div>
    );
  }

  return (
    <Input
      label={label}
      type="text"
      required={isRequired}
      value={String(rawValue)}
      helper={spec.description}
      onChange={(e) => onChange(fieldKey, e.target.value)}
    />
  );
}

// ── ScheduleForm ──────────────────────────────────────────────────────────────

export default function ScheduleForm() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const preselectedSlug = searchParams.get("workflow") ?? "";

  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [selectedSlug, setSelectedSlug] = useState(preselectedSlug);
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null);
  const [params, setParams] = useState<Record<string, unknown>>({});

  const [name, setName] = useState("");
  const [scheduleType, setScheduleType] = useState<ScheduleType>("once");
  const [cronExpr, setCronExpr] = useState("");
  const [runAt, setRunAt] = useState("");

  const [workflowsLoading, setWorkflowsLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<Workflow[]>("/api/v1/workflows")
      .then(({ data }) => {
        const published = data.filter((wf) => wf.status === "published");
        setWorkflows(published);
        if (preselectedSlug) {
          const wf = published.find((w) => w.slug === preselectedSlug) ?? null;
          setSelectedWorkflow(wf);
          if (wf) setParams(initValues(wf.param_schema));
        }
      })
      .catch((err) => setError(apiError(err, "Failed to load workflows.")))
      .finally(() => setWorkflowsLoading(false));
  }, []);

  function handleWorkflowChange(slug: string) {
    setSelectedSlug(slug);
    const wf = workflows.find((w) => w.slug === slug) ?? null;
    setSelectedWorkflow(wf);
    setParams(wf ? initValues(wf.param_schema) : {});
  }

  function handleParamChange(key: string, value: unknown) {
    setParams((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!selectedSlug) {
      setError("Please select a workflow.");
      return;
    }

    setSubmitting(true);
    setError(null);

    const body: Record<string, unknown> = {
      workflow_slug: selectedSlug,
      params,
      name: name.trim() || null,
      schedule_type: scheduleType,
    };

    if (scheduleType === "recurring") {
      body.cron_expr = cronExpr.trim();
    } else {
      // Convert datetime-local to ISO string
      if (runAt) {
        const iso = runAt.includes("Z") ? runAt : runAt.length === 16 ? runAt + ":00Z" : runAt + "Z";
        body.run_at = iso;
      } else {
        body.run_at = null;
      }
    }

    try {
      await api.post<Schedule>("/api/v1/schedules", body);
      toast("Schedule created", "success");
      navigate("/schedules");
    } catch (err) {
      setError(apiError(err, "Failed to create schedule."));
      setSubmitting(false);
    }
  }

  const properties = selectedWorkflow?.param_schema?.properties ?? {};
  const requiredSet = new Set(selectedWorkflow?.param_schema?.required ?? []);
  const hasParams = Object.keys(properties).length > 0;
  const cronDescription = cronHuman(cronExpr);

  return (
    <div className="px-8 py-8 max-w-2xl mx-auto">
      {/* Back link */}
      <Link
        to="/schedules"
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 transition-colors mb-6"
      >
        <ChevronLeft className="size-4" />
        Schedules
      </Link>

      <PageHeader title="New Schedule" className="mb-6" />

      {error && (
        <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Section 1 — Workflow */}
        <Card>
          <CardHeader>
            <CardTitle>Workflow</CardTitle>
          </CardHeader>
          <CardContent>
            {workflowsLoading ? (
              <div className="h-9 animate-pulse rounded bg-slate-200" />
            ) : (
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-slate-700">
                  Workflow <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={selectedSlug}
                  onChange={(e) => handleWorkflowChange(e.target.value)}
                  className="h-9 w-full rounded border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="">— Select a published workflow —</option>
                  {workflows.map((wf) => (
                    <option key={wf.slug} value={wf.slug}>
                      {wf.name} ({wf.slug})
                    </option>
                  ))}
                </select>
                {workflows.length === 0 && !workflowsLoading && (
                  <p className="text-xs text-slate-500">
                    No published workflows available.
                  </p>
                )}
                {selectedWorkflow?.description && (
                  <p className="mt-1 text-xs text-slate-500">
                    {selectedWorkflow.description}
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Section 2 — Parameters */}
        {selectedWorkflow && (
          <Card>
            <CardHeader>
              <CardTitle>Parameters</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {hasParams ? (
                Object.entries(properties).map(([key, spec]) => (
                  <ParamField
                    key={key}
                    fieldKey={key}
                    spec={spec}
                    value={params[key]}
                    isRequired={requiredSet.has(key)}
                    onChange={handleParamChange}
                  />
                ))
              ) : (
                <p className="text-sm italic text-slate-500">
                  This workflow requires no parameters.
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Section 3 — Schedule settings */}
        <Card>
          <CardHeader>
            <CardTitle>Schedule settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Optional name */}
            <Input
              label="Name"
              helper="Leave blank to auto-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Weekly north extraction"
            />

            {/* Schedule type toggle */}
            <div className="flex flex-col gap-1.5">
              <p className="text-sm font-medium text-slate-700">
                Schedule type <span className="text-red-500">*</span>
              </p>
              <div className="grid grid-cols-2 gap-3">
                <label
                  className={cn(
                    "flex items-center gap-3 rounded-lg border p-4 cursor-pointer transition-colors",
                    scheduleType === "once"
                      ? "border-primary-600 bg-primary-50"
                      : "border-slate-200 hover:border-slate-300"
                  )}
                >
                  <input
                    type="radio"
                    name="schedule_type"
                    value="once"
                    checked={scheduleType === "once"}
                    onChange={() => setScheduleType("once")}
                    className="sr-only"
                  />
                  <Clock className="size-4 shrink-0 text-slate-500" />
                  <div>
                    <p className="text-sm font-medium text-slate-800">Run once</p>
                    <p className="text-xs text-slate-500">One-time execution</p>
                  </div>
                </label>
                <label
                  className={cn(
                    "flex items-center gap-3 rounded-lg border p-4 cursor-pointer transition-colors",
                    scheduleType === "recurring"
                      ? "border-primary-600 bg-primary-50"
                      : "border-slate-200 hover:border-slate-300"
                  )}
                >
                  <input
                    type="radio"
                    name="schedule_type"
                    value="recurring"
                    checked={scheduleType === "recurring"}
                    onChange={() => setScheduleType("recurring")}
                    className="sr-only"
                  />
                  <RefreshCw className="size-4 shrink-0 text-slate-500" />
                  <div>
                    <p className="text-sm font-medium text-slate-800">Recurring</p>
                    <p className="text-xs text-slate-500">Repeat on a schedule</p>
                  </div>
                </label>
              </div>
            </div>

            {/* Once — datetime picker */}
            {scheduleType === "once" && (
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-slate-700">
                  Run at <span className="text-red-500">*</span>
                </label>
                <input
                  type="datetime-local"
                  required
                  value={runAt}
                  onChange={(e) => setRunAt(e.target.value)}
                  className="h-9 w-full rounded border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
                <p className="text-xs text-slate-500">
                  Time is interpreted in your local timezone.
                </p>
              </div>
            )}

            {/* Recurring — cron */}
            {scheduleType === "recurring" && (
              <div className="space-y-3">
                <Input
                  label="Cron expression"
                  required
                  placeholder="0 8 * * 1"
                  value={cronExpr}
                  onChange={(e) => setCronExpr(e.target.value)}
                  helper={cronDescription || undefined}
                  className="font-mono"
                />

                {/* Cron reference box */}
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <p className="mb-2 text-xs font-semibold text-slate-700">
                    Cron format
                  </p>
                  <table className="w-full text-xs">
                    <tbody>
                      {[
                        ["0 8 * * 1", "Every Monday at 8 AM"],
                        ["0 */6 * * *", "Every 6 hours"],
                        ["30 9 * * 1-5", "Weekdays at 9:30 AM"],
                      ].map(([expr, label]) => (
                        <tr key={expr}>
                          <td className="py-0.5 pr-4 font-mono text-slate-600">
                            {expr}
                          </td>
                          <td className="py-0.5 text-slate-500">{label}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Submit */}
        <div className="flex items-center gap-3 pt-1">
          <Button
            type="submit"
            variant="primary"
            loading={submitting}
            disabled={!selectedSlug}
          >
            Create Schedule
          </Button>
          <Link
            to="/schedules"
            className="text-sm text-slate-500 hover:text-slate-700 transition-colors"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
