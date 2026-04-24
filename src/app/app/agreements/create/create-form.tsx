"use client";

import { useMemo, useState, useTransition } from "react";
import {
  generateAgreement,
  getAgreementDownloadUrl,
  getLeadAutofillValues,
} from "@/actions/agreements";
import type { AgreementTemplate, AgreementVariable } from "@/lib/types";
import { applyFormat, computeValue } from "@/lib/agreements/compute";

type LeadOption = { id: string; name: string; address: string | null };
type Props = {
  templates: AgreementTemplate[];
  leads: LeadOption[];
};

type FormState = Record<string, string | boolean>;

export function CreateAgreementForm({ templates, leads }: Props) {
  const [templateId, setTemplateId] = useState<string>("");
  const [leadId, setLeadId] = useState<string>("");
  const [values, setValues] = useState<FormState>({});
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [generatedId, setGeneratedId] = useState<string | null>(null);

  const template = useMemo(
    () => templates.find((t) => t.id === templateId) ?? null,
    [templates, templateId]
  );

  // ---- helpers ----

  function seedInitialValues(tpl: AgreementTemplate): FormState {
    const next: FormState = {};
    for (const v of tpl.variables) {
      if (v.type === "checkbox") {
        next[v.key] = v.defaultValue === true;
      } else if (v.type === "radio") {
        next[v.key] = ""; // stores selected option's placeholderKey
      } else {
        next[v.key] =
          typeof v.defaultValue === "string" ? v.defaultValue : "";
      }
      if (v.conditional) next[v.conditional.key] = "";
      if (v.radioOptions) {
        for (const opt of v.radioOptions) {
          if (opt.conditional) next[opt.conditional.key] = "";
        }
      }
    }
    return recomputeComputeds(next, tpl);
  }

  function recomputeComputeds(state: FormState, tpl: AgreementTemplate): FormState {
    const next = { ...state };
    for (const v of tpl.variables) {
      if (v.type === "computed" && v.computed) {
        next[v.key] = computeValue(v.computed, next, v.format);
      }
    }
    return next;
  }

  function onTemplateChange(id: string) {
    setTemplateId(id);
    setGeneratedId(null);
    setError(null);
    const tpl = templates.find((t) => t.id === id);
    const seeded = tpl ? seedInitialValues(tpl) : {};
    setValues(seeded);
    if (tpl && leadId) applyAutofill(tpl, leadId, seeded);
  }

  function onLeadChange(id: string) {
    setLeadId(id);
    if (template && id) applyAutofill(template, id, values);
    if (!id && template) {
      // Clear autofilled values, keep manual edits? Simplest: re-seed
      setValues(seedInitialValues(template));
    }
  }

  function applyAutofill(
    tpl: AgreementTemplate,
    lid: string,
    baseline: FormState
  ) {
    startTransition(async () => {
      const res = await getLeadAutofillValues(lid);
      if (!res.success) return;
      const autofill = res.data;
      const next = { ...baseline };
      for (const v of tpl.variables) {
        if (v.autofillFrom && autofill[v.autofillFrom] !== undefined) {
          next[v.key] = autofill[v.autofillFrom];
        }
      }
      setValues(recomputeComputeds(next, tpl));
    });
  }

  function setValue(key: string, value: string | boolean) {
    if (!template) return;
    setValues((prev) =>
      recomputeComputeds({ ...prev, [key]: value }, template)
    );
  }

  // Build the values sent to the server — expand radio options into placeholder fills,
  // apply format to text fields, convert booleans for checkboxes.
  function resolveForSubmit(tpl: AgreementTemplate, state: FormState) {
    const out: Record<string, string | boolean> = {};
    for (const v of tpl.variables) {
      if (v.type === "radio") {
        const selected = (state[v.key] as string) ?? "";
        for (const opt of v.radioOptions ?? []) {
          out[opt.placeholderKey] = selected === opt.placeholderKey ? "X" : "";
          if (opt.conditional) {
            out[opt.conditional.key] =
              selected === opt.placeholderKey
                ? (state[opt.conditional.key] as string) ?? ""
                : "";
          }
        }
      } else if (v.type === "checkbox") {
        out[v.key] = state[v.key] === true ? "X" : "";
        if (v.conditional) {
          const match =
            (state[v.key] as boolean) === v.conditional.showWhen;
          out[v.conditional.key] = match
            ? (state[v.conditional.key] as string) ?? ""
            : "";
        }
      } else if (v.type === "computed") {
        // already resolved via recomputeComputeds
        out[v.key] = (state[v.key] as string) ?? "";
      } else if (v.format && v.format !== "none") {
        // Apply display format at submission time for text fields
        const raw = (state[v.key] as string) ?? "";
        out[v.key] = applyFormat(raw, v.format);
      } else {
        out[v.key] = state[v.key] ?? "";
      }
    }
    return out;
  }

  async function onGenerate() {
    if (!template) return;
    setError(null);
    setGeneratedId(null);

    // Required check
    for (const v of template.variables) {
      if (v.required && v.type !== "checkbox") {
        const val = values[v.key];
        if (!val || (typeof val === "string" && !val.trim())) {
          setError(`"${v.label}" is required`);
          return;
        }
      }
    }

    const resolved = resolveForSubmit(template, values);
    startTransition(async () => {
      const res = await generateAgreement({
        template_id: template.id,
        lead_id: leadId || null,
        values: resolved,
      });
      if (!res.success) {
        setError(res.error);
        return;
      }
      setGeneratedId(res.data.id);
    });
  }

  async function onDownload() {
    if (!generatedId) return;
    const res = await getAgreementDownloadUrl(generatedId);
    if (res.success) window.open(res.data, "_blank");
  }

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-lg border border-dashed border-neutral-300 bg-white p-5 shadow-sm space-y-4">
        <div>
          <label className="text-xs font-medium text-neutral-600">
            Agreement Type
          </label>
          <select
            value={templateId}
            onChange={(e) => onTemplateChange(e.target.value)}
            className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm"
          >
            <option value="">Select a template…</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>

        {template && (
          <div>
            <label className="text-xs font-medium text-neutral-600">
              Lead / Property{" "}
              <span className="text-neutral-400">(for autofill)</span>
            </label>
            <select
              value={leadId}
              onChange={(e) => onLeadChange(e.target.value)}
              className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm"
            >
              <option value="">None — fill all fields manually</option>
              {leads.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                  {l.address ? ` — ${l.address}` : ""}
                </option>
              ))}
            </select>
          </div>
        )}
      </section>

      {template && (
        <section className="rounded-lg border border-dashed border-neutral-300 bg-white p-5 shadow-sm space-y-4">
          <h2 className="text-sm font-medium text-neutral-700">Fields</h2>
          <p className="text-xs text-neutral-500">
            Prefilled values come from the lead record, defaults, or
            computed logic. All fields are editable.
          </p>
          <div className="space-y-4">
            {template.variables.map((v) => (
              <FieldRow
                key={v.key}
                variable={v}
                values={values}
                onChange={setValue}
              />
            ))}
          </div>

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </div>
          )}

          <div className="flex items-center gap-2 pt-2">
            <button
              type="button"
              onClick={onGenerate}
              disabled={isPending}
              className="rounded-md border border-[#c5cca8] bg-[#e8edda] px-3 py-1.5 text-sm hover:bg-[#dce3cb] disabled:opacity-50"
            >
              {isPending ? "Generating…" : "Generate PDF"}
            </button>
            {generatedId && (
              <button
                type="button"
                onClick={onDownload}
                className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm hover:bg-neutral-50"
              >
                Download
              </button>
            )}
            {generatedId && (
              <span className="text-xs text-neutral-500">
                Saved to Database
              </span>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

function FieldRow({
  variable,
  values,
  onChange,
}: {
  variable: AgreementVariable;
  values: FormState;
  onChange: (key: string, value: string | boolean) => void;
}) {
  const value = values[variable.key];

  if (variable.type === "checkbox") {
    const checked = value === true;
    const showConditional =
      variable.conditional && checked === variable.conditional.showWhen;
    return (
      <div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => onChange(variable.key, e.target.checked)}
            className="h-4 w-4"
          />
          {variable.label}
          {variable.required && <span className="text-red-500">*</span>}
        </label>
        {showConditional && variable.conditional && (
          <div className="mt-2 ml-6 flex items-center gap-2">
            {variable.conditional.type === "text" ? (
              <input
                type="text"
                value={(values[variable.conditional.key] as string) ?? ""}
                onChange={(e) =>
                  variable.conditional &&
                  onChange(variable.conditional.key, e.target.value)
                }
                placeholder={variable.conditional.label}
                className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-sm w-32"
              />
            ) : (
              <select
                value={(values[variable.conditional.key] as string) ?? ""}
                onChange={(e) =>
                  variable.conditional &&
                  onChange(variable.conditional.key, e.target.value)
                }
                className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-sm"
              >
                <option value="">Select…</option>
                {variable.conditional.options?.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            )}
            {variable.conditional.suffix && (
              <span className="text-sm text-neutral-600">
                {variable.conditional.suffix}
              </span>
            )}
          </div>
        )}
      </div>
    );
  }

  if (variable.type === "radio") {
    const selected = (value as string) ?? "";
    return (
      <div>
        <div className="text-xs font-medium text-neutral-600 mb-2">
          {variable.label}
          {variable.required && <span className="text-red-500">*</span>}
        </div>
        <div className="space-y-2">
          {(variable.radioOptions ?? []).map((opt) => {
            const isSelected = selected === opt.placeholderKey;
            return (
              <div key={opt.placeholderKey}>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name={variable.key}
                    checked={isSelected}
                    onChange={() => onChange(variable.key, opt.placeholderKey)}
                    className="h-4 w-4"
                  />
                  {opt.label}
                </label>
                {isSelected && opt.conditional && (
                  <div className="mt-1 ml-6 flex items-center gap-2">
                    {opt.conditional.type === "text" ? (
                      <input
                        type="text"
                        value={(values[opt.conditional.key] as string) ?? ""}
                        onChange={(e) =>
                          opt.conditional &&
                          onChange(opt.conditional.key, e.target.value)
                        }
                        placeholder={opt.conditional.label}
                        className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-sm w-32"
                      />
                    ) : (
                      <select
                        value={(values[opt.conditional.key] as string) ?? ""}
                        onChange={(e) =>
                          opt.conditional &&
                          onChange(opt.conditional.key, e.target.value)
                        }
                        className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-sm"
                      >
                        <option value="">Select…</option>
                        {opt.conditional.options?.map((o) => (
                          <option key={o} value={o}>
                            {o}
                          </option>
                        ))}
                      </select>
                    )}
                    {opt.conditional.suffix && (
                      <span className="text-sm text-neutral-600">
                        {opt.conditional.suffix}
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (variable.type === "dropdown") {
    return (
      <div>
        <label className="text-xs font-medium text-neutral-600">
          {variable.label}
          {variable.required && <span className="text-red-500">*</span>}
        </label>
        <select
          value={(value as string) ?? ""}
          onChange={(e) => onChange(variable.key, e.target.value)}
          className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm"
        >
          <option value="">Select…</option>
          {variable.options?.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </div>
    );
  }

  // text or computed — both render as text inputs (computed is overridable)
  return (
    <div>
      <label className="text-xs font-medium text-neutral-600 flex items-center gap-2">
        {variable.label}
        {variable.required && <span className="text-red-500">*</span>}
        {variable.type === "computed" && (
          <span className="text-[0.65rem] text-neutral-400 font-normal">
            (auto)
          </span>
        )}
      </label>
      <input
        type="text"
        value={(value as string) ?? ""}
        onChange={(e) => onChange(variable.key, e.target.value)}
        className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm"
      />
    </div>
  );
}
