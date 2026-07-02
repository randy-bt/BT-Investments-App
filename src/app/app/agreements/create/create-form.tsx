"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  generateAgreement,
  getAgreementDownloadUrl,
  getLeadAutofillValues,
  listLeadProperties,
} from "@/actions/agreements";
import type {
  AgreementTemplate,
  AgreementVariable,
  GeneratedAgreement,
} from "@/lib/types";
import { applyFormat, computeValue, parseDateSmart } from "@/lib/agreements/compute";
import { parseCurrency } from "@/lib/agreements/number-to-words";
import { Combobox, type ComboboxOption } from "@/components/Combobox";

type LeadOption = { id: string; name: string; address: string | null };
type Props = {
  templates: AgreementTemplate[];
  leads: LeadOption[];
};

type FormState = Record<string, string | boolean>;

export function CreateAgreementForm({ templates, leads }: Props) {
  const router = useRouter();
  const [templateId, setTemplateId] = useState<string>("");
  const [leadId, setLeadId] = useState<string>("");
  const [values, setValues] = useState<FormState>({});
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [missingRequired, setMissingRequired] = useState<string[]>([]);
  // Automated pre-send review of the last generated PDF (checks + AI).
  const [genReview, setGenReview] = useState<GeneratedAgreement["review"]>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  // Computed fields the user has manually edited — recompute skips these so
  // the auto-calculation can't clobber a manual override. Clearing the field
  // hands it back to auto.
  const [overriddenKeys, setOverriddenKeys] = useState<Set<string>>(new Set());
  // Multi-property leads: which property drives the autofill.
  const [leadProperties, setLeadProperties] = useState<
    { id: string; address: string | null }[]
  >([]);
  const [propertyId, setPropertyId] = useState<string>("");

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
    return recomputeComputeds(next, tpl, new Set());
  }

  function recomputeComputeds(
    state: FormState,
    tpl: AgreementTemplate,
    overridden: Set<string>
  ): FormState {
    const next = { ...state };
    for (const v of tpl.variables) {
      // Skip fields the user has manually overridden — their edit wins.
      if (v.type === "computed" && v.computed && !overridden.has(v.key)) {
        next[v.key] = computeValue(v.computed, next, v.format);
      }
    }
    return next;
  }

  function onTemplateChange(id: string) {
    setTemplateId(id);
    setError(null);
    setOverriddenKeys(new Set());
    const tpl = templates.find((t) => t.id === id);
    const seeded = tpl ? seedInitialValues(tpl) : {};
    setValues(seeded);
    if (tpl && leadId) applyAutofill(tpl, leadId, seeded, propertyId || undefined);
  }

  function onLeadChange(id: string) {
    setLeadId(id);
    setPropertyId("");
    setLeadProperties([]);
    if (template && id) {
      applyAutofill(template, id, values);
      // Load the lead's properties so multi-property leads get a picker.
      startTransition(async () => {
        const res = await listLeadProperties(id);
        if (res.success) {
          setLeadProperties(res.data);
          if (res.data.length > 0) setPropertyId(res.data[0].id);
        }
      });
    }
    if (!id && template) {
      // Clear autofilled values, keep manual edits? Simplest: re-seed
      setOverriddenKeys(new Set());
      setValues(seedInitialValues(template));
    }
  }

  function onPropertyChange(pid: string) {
    setPropertyId(pid);
    if (template && leadId && pid) applyAutofill(template, leadId, values, pid);
  }

  function applyAutofill(
    tpl: AgreementTemplate,
    lid: string,
    baseline: FormState,
    pid?: string
  ) {
    startTransition(async () => {
      const res = await getLeadAutofillValues(lid, pid);
      if (!res.success) return;
      const autofill = res.data;
      const next = { ...baseline };
      for (const v of tpl.variables) {
        if (v.autofillFrom && autofill[v.autofillFrom] !== undefined) {
          next[v.key] = autofill[v.autofillFrom];
        }
      }
      setValues(recomputeComputeds(next, tpl, overriddenKeys));
    });
  }

  function setValue(key: string, value: string | boolean) {
    if (!template) return;
    // Any form edit resets the click-through warning — user has to confirm
    // again if they still have blanks after the change.
    if (missingRequired.length > 0) setMissingRequired([]);

    // Editing a computed field marks it overridden (auto-calc stops touching
    // it); clearing it returns it to auto.
    const variable = template.variables.find((v) => v.key === key);
    let overridden = overriddenKeys;
    if (variable?.type === "computed") {
      overridden = new Set(overriddenKeys);
      if (typeof value === "string" && value.trim() === "") {
        overridden.delete(key);
      } else {
        overridden.add(key);
      }
      setOverriddenKeys(overridden);
    }

    setValues((prev) =>
      recomputeComputeds({ ...prev, [key]: value }, template, overridden)
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
          out[opt.placeholderKey] = selected === opt.placeholderKey ? "X" : " ";
          if (opt.conditional) {
            out[opt.conditional.key] =
              selected === opt.placeholderKey
                ? (state[opt.conditional.key] as string) ?? ""
                : "";
          }
        }
      } else if (v.type === "checkbox") {
        out[v.key] = state[v.key] === true ? "X" : " ";
        if (v.conditional) {
          const match =
            (state[v.key] as boolean) === v.conditional.showWhen;
          out[v.conditional.key] = match
            ? (state[v.conditional.key] as string) ?? ""
            : "";
        }
      } else if (v.type === "computed") {
        // Auto values are already formatted; re-applying is a no-op for them
        // but formats manually-overridden raw text (e.g. "7/8" → "July 8, 2026").
        const raw = (state[v.key] as string) ?? "";
        out[v.key] =
          v.format && v.format !== "none" ? applyFormat(raw, v.format) : raw;
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

  async function onGenerate(force = false) {
    if (!template) return;
    setError(null);

    // Collect the required fields that are blank.
    const missing: string[] = [];
    for (const v of template.variables) {
      if (v.required && v.type !== "checkbox") {
        const val = values[v.key];
        if (!val || (typeof val === "string" && !val.trim())) {
          missing.push(v.label);
        }
      }
    }

    // Blanks require an explicit "Generate anyway" click on the warning
    // banner — the main button never proceeds with blanks, so a double-click
    // can't accidentally blow past the warning.
    if (missing.length > 0 && !force) {
      setMissingRequired(missing);
      return;
    }
    if (missing.length === 0) setMissingRequired([]);

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
      // Always stay on the page and show the automated review of what was
      // just generated — the user leaves via "Continue to Agreements".
      setGenReview(
        res.data.review ?? { issues: [], ai_ok: false, reviewed_at: "" }
      );
      setReviewOpen(true);
      const urlRes = await getAgreementDownloadUrl(res.data.id);
      if (urlRes.success) window.open(urlRes.data, "_blank");
    });
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
            <Combobox<LeadOption>
              className="mt-1"
              options={leads.map<ComboboxOption<LeadOption>>((l) => ({
                value: l.id,
                label: l.name,
                sublabel: l.address ?? null,
                raw: l,
              }))}
              value={leadId}
              onChange={(v) => onLeadChange(v)}
              placeholder="None — type to search by name or address"
            />
            {leadProperties.length > 1 && (
              <div className="mt-2">
                <label className="text-xs font-medium text-neutral-600 dark:text-neutral-400">
                  Property{" "}
                  <span className="text-neutral-400 dark:text-neutral-500">
                    (this lead has {leadProperties.length} — autofill uses the selected one)
                  </span>
                </label>
                <select
                  value={propertyId}
                  onChange={(e) => onPropertyChange(e.target.value)}
                  className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
                >
                  {leadProperties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.address ?? "(no address)"}
                    </option>
                  ))}
                </select>
              </div>
            )}
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
                overridden={overriddenKeys.has(v.key)}
              />
            ))}
          </div>

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </div>
          )}

          {reviewOpen && genReview && (
            <ReviewPanel
              review={genReview}
              onContinue={() => router.push("/app/agreements")}
            />
          )}

          {missingRequired.length > 0 && (
            <div className="rounded border border-amber-300 bg-amber-50 px-3 py-3 text-sm text-amber-900 space-y-2 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
              <p className="font-medium">
                The following required fields are blank: {missingRequired.join(", ")}.
              </p>
              <p className="text-xs">
                The PDF will render those as blank lines you can fill in by hand.
              </p>
              <button
                type="button"
                onClick={() => onGenerate(true)}
                disabled={isPending}
                className="rounded border border-amber-400 bg-white px-3 py-1 text-xs font-medium hover:bg-amber-100 disabled:opacity-50 dark:border-amber-600 dark:bg-amber-900 dark:hover:bg-amber-800"
              >
                Generate anyway with blanks
              </button>
            </div>
          )}

          <div className="flex items-center gap-2 pt-2">
            <button
              type="button"
              onClick={() => onGenerate(false)}
              disabled={isPending}
              className="rounded-md border border-[#c5cca8] bg-[#e8edda] px-3 py-1.5 text-sm hover:bg-[#dce3cb] disabled:opacity-50"
            >
              {isPending ? "Generating…" : "Generate PDF"}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

// Post-generation review panel: mechanical checks + AI read of the final
// contract. Green when clean; otherwise issues grouped by severity so
// nothing gets sent with an unseen problem.
function ReviewPanel({
  review,
  onContinue,
}: {
  review: NonNullable<GeneratedAgreement["review"]>;
  onContinue: () => void;
}) {
  const errors = review.issues.filter((i) => i.severity === "error");
  const warnings = review.issues.filter((i) => i.severity === "warning");
  const notes = review.issues.filter((i) => i.severity === "note");
  const clean = review.issues.length === 0;

  return (
    <div
      className={`rounded border px-3 py-3 text-sm space-y-2 ${
        errors.length > 0
          ? "border-red-300 bg-red-50 text-red-900"
          : warnings.length > 0
            ? "border-amber-300 bg-amber-50 text-amber-900"
            : "border-green-300 bg-green-50 text-green-900"
      }`}
    >
      <p className="font-medium">
        {clean
          ? "✓ Contract review passed — no issues found."
          : errors.length > 0
            ? `Contract review found ${errors.length} problem${errors.length > 1 ? "s" : ""} — check the PDF before sending.`
            : "Contract review finished with warnings — double-check before sending."}
      </p>
      {errors.length > 0 && (
        <ul className="list-disc pl-5 text-xs space-y-1">
          {errors.map((i, idx) => (
            <li key={`e${idx}`} className="font-medium">{i.message}</li>
          ))}
        </ul>
      )}
      {warnings.length > 0 && (
        <ul className="list-disc pl-5 text-xs space-y-1">
          {warnings.map((i, idx) => (
            <li key={`w${idx}`}>{i.message}</li>
          ))}
        </ul>
      )}
      {notes.length > 0 && (
        <ul className="list-disc pl-5 text-xs space-y-1 opacity-80">
          {notes.map((i, idx) => (
            <li key={`n${idx}`}>{i.message}</li>
          ))}
        </ul>
      )}
      {!review.ai_ok && (
        <p className="text-[0.7rem] opacity-70">
          Note: the AI reviewer was unavailable for this run — mechanical
          checks still ran.
        </p>
      )}
      <p className="text-xs opacity-80">
        {clean
          ? "The PDF opened in a new tab."
          : "Fix the fields above and re-generate, or continue if this is intentional."}
      </p>
      <button
        type="button"
        onClick={onContinue}
        className="rounded border border-current bg-white px-3 py-1 text-xs font-medium hover:opacity-80"
      >
        Continue to Agreements
      </button>
    </div>
  );
}

function FieldRow({
  variable,
  values,
  onChange,
  overridden = false,
}: {
  variable: AgreementVariable;
  values: FormState;
  onChange: (key: string, value: string | boolean) => void;
  overridden?: boolean;
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
                className="flex-1 rounded-md border border-neutral-300 bg-white px-2 py-1 text-sm"
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
                        className="flex-1 rounded-md border border-neutral-300 bg-white px-2 py-1 text-sm"
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

  // text or computed — both render as text inputs (computed is overridable:
  // editing stops the auto-calc for that field; clearing re-enables it)
  const strValue = (value as string) ?? "";
  const format = variable.format;
  const hasFormat = !!format && format !== "none";
  const isDateFmt = format === "date_long" || format === "date_short";
  const isCurrencyFmt =
    format === "currency" || format === "number_to_words_currency";
  const printed = hasFormat ? applyFormat(strValue, format) : strValue;
  const unformattable =
    hasFormat &&
    strValue.trim() !== "" &&
    ((isDateFmt && !parseDateSmart(strValue)) ||
      (isCurrencyFmt && isNaN(parseCurrency(strValue))));
  const showPreview =
    hasFormat && strValue.trim() !== "" && !unformattable && printed !== strValue;

  return (
    <div>
      <label className="text-xs font-medium text-neutral-600 flex items-center gap-2">
        {variable.label}
        {variable.required && <span className="text-red-500">*</span>}
        {variable.type === "computed" && (
          <span className="text-[0.65rem] text-neutral-400 font-normal">
            {overridden ? "(manual — clear to go back to auto)" : "(auto)"}
          </span>
        )}
      </label>
      <input
        type="text"
        value={strValue}
        onChange={(e) => onChange(variable.key, e.target.value)}
        placeholder={
          isCurrencyFmt ? "e.g. $615,000" : isDateFmt ? "e.g. July 8, 2026" : undefined
        }
        className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm"
      />
      {unformattable && (
        <p className="mt-1 text-[0.7rem] text-amber-700">
          ⚠ Not a recognizable {isDateFmt ? "date" : "amount"} — the contract
          will print exactly what you typed: “{strValue}”
        </p>
      )}
      {showPreview && (
        <p className="mt-1 text-[0.7rem] text-neutral-400">
          Will print: {printed}
        </p>
      )}
    </div>
  );
}
