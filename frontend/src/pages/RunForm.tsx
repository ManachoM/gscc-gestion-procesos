import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ChevronLeft, Play, AlertTriangle, X } from "lucide-react";
import api from "../lib/api";
import { useToast } from "../contexts/ToastContext";
import { apiError, type Execution, type Workflow, type JsonSchema, type JsonSchemaProperty } from "../types";
import { Button } from "../components/ui/Button";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/Card";
import { Input, Select } from "../components/ui/Input";
import { StatusBadge } from "../components/shared/StatusBadge";

// ── helpers ───────────────────────────────────────────────────────────────────

function initValues(schema: JsonSchema): Record<string, unknown> {
  const props = schema.properties ?? {};
  return Object.fromEntries(
    Object.entries(props).map(([key, spec]) => [key, spec.default ?? ""])
  );
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

  // Enum → Select
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

  // Boolean → checkbox
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

  // Integer / number → number input
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

  // Date string
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

  // Default → plain text Input
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

// ── RunForm ───────────────────────────────────────────────────────────────────

export default function RunForm() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [params, setParams] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isConflict, setIsConflict] = useState(false);

  useEffect(() => {
    if (!slug) return;
    api
      .get<Workflow>(`/api/v1/workflows/${slug}`)
      .then(({ data }) => {
        setWorkflow(data);
        setParams(initValues(data.param_schema));
      })
      .catch((err) => setError(apiError(err, "Failed to load workflow.")))
      .finally(() => setLoading(false));
  }, [slug]);

  function handleParamChange(key: string, value: unknown) {
    setParams((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!workflow) return;
    setSubmitting(true);
    setError(null);
    setIsConflict(false);

    try {
      const { data } = await api.post<Execution>("/api/v1/executions", {
        workflow_slug: workflow.slug,
        params,
      });
      toast("Run started", "success");
      navigate(`/executions/${data.id}`);
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 409) {
        setIsConflict(true);
        setError("A run with these parameters is already in progress.");
      } else {
        setError(apiError(err, "Failed to start execution."));
      }
      setSubmitting(false);
    }
  }

  // ── Loading state ────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="px-8 py-8 max-w-2xl mx-auto">
        <div className="h-5 w-32 animate-pulse rounded bg-slate-200 mb-6" />
        <div className="h-7 w-64 animate-pulse rounded bg-slate-200 mb-2" />
        <div className="h-4 w-96 animate-pulse rounded bg-slate-200 mb-8" />
        <Card>
          <CardContent>
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="space-y-1.5">
                  <div className="h-4 w-24 animate-pulse rounded bg-slate-200" />
                  <div className="h-9 w-full animate-pulse rounded bg-slate-200" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!workflow) {
    return (
      <div className="px-8 py-8 max-w-2xl mx-auto">
        <Link
          to="/workflows"
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 transition-colors mb-6"
        >
          <ChevronLeft className="size-4" />
          Back to workflows
        </Link>
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error ?? "Workflow not found."}
        </div>
      </div>
    );
  }

  const properties = workflow.param_schema?.properties ?? {};
  const requiredSet = new Set(workflow.param_schema?.required ?? []);
  const hasParams = Object.keys(properties).length > 0;

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="px-8 py-8 max-w-2xl mx-auto">
      {/* Back link */}
      <Link
        to="/workflows"
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 transition-colors mb-6"
      >
        <ChevronLeft className="size-4" />
        Back to workflows
      </Link>

      {/* Page header with inline StatusBadge */}
      <div className="flex items-start gap-3 mb-1">
        <h1 className="text-xl font-semibold text-slate-900">{workflow.name}</h1>
        <div className="mt-0.5">
          <StatusBadge status={workflow.status} />
        </div>
      </div>
      {workflow.description && (
        <p className="text-sm text-slate-500 mb-6">{workflow.description}</p>
      )}

      {/* Not-published warning */}
      {workflow.status !== "published" && (
        <div className="mb-5 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertTriangle className="size-4 shrink-0 mt-0.5" />
          <span>This workflow is not published and cannot be run.</span>
        </div>
      )}

      {/* Error / conflict alert */}
      {error && (
        <div
          className={`mb-5 flex items-start gap-3 rounded-lg border px-4 py-3 text-sm ${
            isConflict
              ? "border-amber-200 bg-amber-50 text-amber-800"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          <AlertTriangle className="size-4 shrink-0 mt-0.5" />
          <span className="flex-1">{error}</span>
          <button
            type="button"
            onClick={() => { setError(null); setIsConflict(false); }}
            className="text-current opacity-60 hover:opacity-100 transition-opacity"
          >
            <X className="size-4" />
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Parameters card */}
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
              <p className="text-sm text-slate-500 italic">
                This workflow requires no parameters.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Parameters summary */}
        {hasParams && (
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">
              Parameters summary
            </p>
            <ul className="space-y-1">
              {Object.entries(params).map(([key, val]) => (
                <li key={key} className="text-xs font-mono text-slate-700">
                  <span className="text-slate-500">{key}:</span>{" "}
                  {val === "" || val === undefined || val === null
                    ? <span className="italic text-slate-400">—</span>
                    : String(val)}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Submit actions */}
        <div className="flex items-center gap-3 pt-1">
          <Button
            type="submit"
            variant="primary"
            size="md"
            loading={submitting}
            disabled={workflow.status !== "published"}
            icon={!submitting ? <Play className="size-3.5" /> : undefined}
          >
            Run now
          </Button>
          <Link
            to="/workflows"
            className="text-sm text-slate-500 hover:text-slate-700 transition-colors"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
