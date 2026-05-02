"use client";

import { ReactNode } from "react";

/**
 * Shared form primitives for marketing intake forms (CTA1 SellProperty,
 * CTA2 BuyersList). Centralized here so both forms stay visually
 * consistent and bug fixes / styling tweaks apply to both.
 *
 * Includes:
 *   - ProgressIndicator (3-step wizard header)
 *   - SectionHeading (small olive-uppercase divider inside a step)
 *   - Callout (cream box for "be thorough" messaging)
 *   - Field (single-line or multi-line text input)
 *   - SelectField (single-select dropdown)
 *   - MultiSelectField (chip-style select-all-that-apply)
 *   - YesNoField (segmented Yes/No control)
 *   - StepNav (Back / Continue or Submit row)
 */

/* ───────────────── Progress + structure ───────────────── */

export function ProgressIndicator({
  step,
  steps,
}: {
  step: number;
  steps: { n: number; label: string }[];
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      {steps.map((s, i) => (
        <div key={s.n} className="flex items-center flex-1 min-w-0">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="font-mkt-sans rounded-full flex items-center justify-center shrink-0 transition-colors"
              style={{
                width: 32,
                height: 32,
                background:
                  step >= s.n ? "var(--mkt-olive)" : "rgba(0,0,0,0.08)",
                color:
                  step >= s.n
                    ? "var(--mkt-cream)"
                    : "var(--mkt-muted-light)",
                fontWeight: 600,
                fontSize: "0.85rem",
              }}
            >
              {s.n}
            </div>
            <span
              className="font-mkt-sans text-sm hidden sm:inline truncate"
              style={{
                color:
                  step >= s.n
                    ? "var(--mkt-text-on-light)"
                    : "var(--mkt-muted-light)",
                fontWeight: step === s.n ? 600 : 400,
              }}
            >
              {s.label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div
              className="flex-1 h-px mx-3 sm:mx-4"
              style={{
                background:
                  step > s.n ? "var(--mkt-olive)" : "rgba(0,0,0,0.08)",
              }}
            />
          )}
        </div>
      ))}
    </div>
  );
}

export function SectionHeading({ children }: { children: ReactNode }) {
  return (
    <div
      className="font-mkt-sans uppercase tracking-[0.28em] text-[0.65rem] pt-2"
      style={{ color: "var(--mkt-olive)" }}
    >
      {children}
    </div>
  );
}

export function Callout({ children }: { children: ReactNode }) {
  return (
    <div
      className="rounded-lg p-4 font-mkt-sans text-sm"
      style={{
        background: "rgba(118, 121, 76, 0.10)",
        color: "var(--mkt-text-on-light)",
        lineHeight: 1.5,
        border: "1px solid rgba(118, 121, 76, 0.18)",
      }}
    >
      {children}
    </div>
  );
}

/* ───────────────── Field building blocks ───────────────── */

export const fieldInputClass =
  "w-full px-4 py-3 rounded-lg font-mkt-sans text-base font-medium outline-none transition-colors";

export function FieldShell({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <div
        className="font-mkt-sans uppercase tracking-[0.18em] text-[0.65rem] mb-2 font-semibold"
        style={{ color: "var(--mkt-muted-light)" }}
      >
        {label}{" "}
        {required && <span style={{ color: "var(--mkt-olive)" }}>*</span>}
      </div>
      {children}
    </label>
  );
}

const inputStyle = {
  background: "var(--mkt-cream)",
  color: "var(--mkt-text-on-light)",
  border: "1px solid rgba(0,0,0,0.1)",
};

export function Field({
  label,
  type = "text",
  placeholder,
  value,
  onChange,
  required,
  multiline,
}: {
  label: string;
  type?: string;
  placeholder?: string;
  value: string;
  onChange: (s: string) => void;
  required?: boolean;
  multiline?: boolean;
}) {
  return (
    <FieldShell label={label} required={required}>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          rows={3}
          className={`${fieldInputClass} resize-y min-h-[88px]`}
          style={inputStyle}
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          className={fieldInputClass}
          style={inputStyle}
        />
      )}
    </FieldShell>
  );
}

export function SelectField({
  label,
  value,
  onChange,
  options,
  placeholder,
  required,
}: {
  label: string;
  value: string;
  onChange: (s: string) => void;
  options: string[];
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <FieldShell label={label} required={required}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className={fieldInputClass}
        style={{
          background: "var(--mkt-cream)",
          color: value
            ? "var(--mkt-text-on-light)"
            : "var(--mkt-muted-light)",
          border: "1px solid rgba(0,0,0,0.1)",
          appearance: "auto",
        }}
      >
        <option value="" disabled>
          {placeholder ?? "Select one"}
        </option>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}

export function MultiSelectField({
  label,
  values,
  onChange,
  options,
  required,
  helpText,
}: {
  label: string;
  values: string[];
  onChange: (next: string[]) => void;
  options: string[];
  required?: boolean;
  helpText?: string;
}) {
  function toggle(opt: string) {
    if (values.includes(opt)) {
      onChange(values.filter((v) => v !== opt));
    } else {
      onChange([...values, opt]);
    }
  }
  return (
    <FieldShell label={label} required={required}>
      {helpText && (
        <div
          className="font-mkt-sans text-xs mb-2 -mt-1"
          style={{ color: "var(--mkt-muted-light)" }}
        >
          {helpText}
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => {
          const active = values.includes(opt);
          return (
            <button
              key={opt}
              type="button"
              onClick={() => toggle(opt)}
              className="rounded-full px-4 py-2 font-mkt-sans transition-colors"
              style={{
                background: active
                  ? "var(--mkt-olive)"
                  : "var(--mkt-cream)",
                color: active
                  ? "var(--mkt-cream)"
                  : "var(--mkt-text-on-light)",
                border: active
                  ? "1px solid var(--mkt-olive)"
                  : "1px solid rgba(0,0,0,0.1)",
                fontSize: "0.85rem",
                fontWeight: 500,
              }}
            >
              {opt}
            </button>
          );
        })}
      </div>
    </FieldShell>
  );
}

export function YesNoField({
  label,
  value,
  onChange,
  required,
}: {
  label: string;
  value: "" | "yes" | "no";
  onChange: (v: "" | "yes" | "no") => void;
  required?: boolean;
}) {
  return (
    <FieldShell label={label} required={required}>
      <div className="flex gap-3">
        {(["yes", "no"] as const).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => onChange(v)}
            className="flex-1 rounded-lg font-mkt-sans py-3 transition-colors"
            style={{
              background:
                value === v ? "var(--mkt-olive)" : "var(--mkt-cream)",
              color:
                value === v
                  ? "var(--mkt-cream)"
                  : "var(--mkt-text-on-light)",
              border: "1px solid rgba(0,0,0,0.1)",
              fontWeight: 500,
            }}
          >
            {v === "yes" ? "Yes" : "No"}
          </button>
        ))}
      </div>
    </FieldShell>
  );
}

/* ───────────────── Step navigation ───────────────── */

export function StepNav({
  onBack,
  onContinue,
  canContinue,
  isFirst,
  isLast,
  canSubmit,
  submitLabel = "Submit",
}: {
  onBack?: () => void;
  onContinue?: () => void;
  canContinue?: boolean;
  isFirst?: boolean;
  isLast?: boolean;
  canSubmit?: boolean;
  submitLabel?: string;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:justify-between gap-3 pt-4">
      {!isFirst ? (
        <button
          type="button"
          onClick={onBack}
          className="rounded-full font-mkt-sans px-6 py-3 transition-opacity hover:opacity-80"
          style={{
            background: "transparent",
            color: "var(--mkt-text-on-light)",
            border: "1px solid rgba(0,0,0,0.15)",
            fontSize: "0.95rem",
            fontWeight: 500,
          }}
        >
          ← Back
        </button>
      ) : (
        <span />
      )}
      {isLast ? (
        <button
          type="submit"
          disabled={!canSubmit}
          className="rounded-full font-mkt-sans px-8 py-3 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed enabled:hover:opacity-90"
          style={{
            background: "var(--mkt-olive)",
            color: "var(--mkt-cream)",
            fontSize: "0.95rem",
            fontWeight: 500,
          }}
        >
          {submitLabel}
        </button>
      ) : (
        <button
          type="button"
          onClick={onContinue}
          disabled={!canContinue}
          className="rounded-full font-mkt-sans px-8 py-3 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed enabled:hover:opacity-90"
          style={{
            background: "var(--mkt-olive)",
            color: "var(--mkt-cream)",
            fontSize: "0.95rem",
            fontWeight: 500,
          }}
        >
          Continue →
        </button>
      )}
    </div>
  );
}
