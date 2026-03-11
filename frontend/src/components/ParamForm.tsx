/**
 * ParamForm — renders a dynamic form from a JSON Schema object.
 *
 * Supports: string, string+date format, string+enum, integer, number, boolean.
 * The parent owns the values state; this component calls onChange per field.
 */
import type { JsonSchema } from "../types";

const inputStyle: React.CSSProperties = {
  padding: "0.35rem 0.5rem",
  width: "100%",
  boxSizing: "border-box",
  border: "1px solid #ccc",
  borderRadius: "3px",
  fontSize: "0.95rem",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  marginBottom: "0.25rem",
  fontWeight: 500,
  fontSize: "0.9rem",
};

const hintStyle: React.CSSProperties = {
  fontSize: "0.78rem",
  color: "#888",
  marginTop: "0.2rem",
};

interface Props {
  schema: JsonSchema;
  values: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
}

/** Build an initial values dict from schema defaults. */
export function initValues(schema: JsonSchema): Record<string, unknown> {
  const props = schema.properties ?? {};
  return Object.fromEntries(
    Object.entries(props).map(([key, spec]) => [key, spec.default ?? ""])
  );
}

export default function ParamForm({ schema, values, onChange }: Props) {
  const properties = schema.properties ?? {};
  const requiredSet = new Set(schema.required ?? []);

  if (Object.keys(properties).length === 0) {
    return <p style={{ color: "#888", fontStyle: "italic" }}>This workflow requires no parameters.</p>;
  }

  return (
    <div>
      {Object.entries(properties).map(([key, spec]) => {
        const isRequired = requiredSet.has(key);
        const rawValue = values[key] ?? spec.default ?? "";
        const label = spec.title ?? key;

        let input: React.ReactNode;

        if (spec.enum && spec.enum.length > 0) {
          input = (
            <select
              style={inputStyle}
              value={String(rawValue)}
              onChange={(e) => onChange(key, e.target.value)}
              required={isRequired}
            >
              <option value="">— Select —</option>
              {spec.enum.map((v) => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          );
        } else if (spec.type === "boolean") {
          input = (
            <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={Boolean(rawValue)}
                onChange={(e) => onChange(key, e.target.checked)}
              />
              <span style={{ fontSize: "0.9rem" }}>{label}</span>
            </label>
          );
        } else if (spec.type === "integer" || spec.type === "number") {
          input = (
            <input
              style={inputStyle}
              type="number"
              value={rawValue === "" ? "" : String(rawValue)}
              onChange={(e) =>
                onChange(key, e.target.value === "" ? "" : Number(e.target.value))
              }
              min={spec.minimum}
              max={spec.maximum}
              required={isRequired}
            />
          );
        } else if (spec.format === "date") {
          input = (
            <input
              style={inputStyle}
              type="date"
              value={String(rawValue)}
              onChange={(e) => onChange(key, e.target.value)}
              required={isRequired}
            />
          );
        } else {
          input = (
            <input
              style={inputStyle}
              type="text"
              value={String(rawValue)}
              onChange={(e) => onChange(key, e.target.value)}
              required={isRequired}
            />
          );
        }

        return (
          <div key={key} style={{ marginBottom: "1rem" }}>
            {spec.type !== "boolean" && (
              <label style={labelStyle}>
                {label}
                {isRequired && <span style={{ color: "#b91c1c" }}> *</span>}
              </label>
            )}
            {input}
            {spec.description && <p style={hintStyle}>{spec.description}</p>}
            {spec.minimum !== undefined && (
              <p style={hintStyle}>Min: {spec.minimum}{spec.maximum !== undefined ? ` · Max: ${spec.maximum}` : ""}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
