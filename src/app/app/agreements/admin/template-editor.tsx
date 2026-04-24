"use client";

import { useState } from "react";
import type {
  AgreementTemplate,
  AgreementVariable,
  AgreementRadioOption,
  AgreementComputedConfig,
  AgreementValueFormat,
  AgreementComputedFn,
} from "@/lib/types";

const AUTOFILL_FIELDS = [
  "lead_name",
  "lead_mailing_address",
  "lead_occupancy_status",
  "lead_asking_price",
  "lead_our_current_offer",
  "lead_range",
  "lead_selling_timeline",
  "lead_condition",
  "lead_emd_date",
  "lead_closing_date",
  "lead_primary_phone",
  "lead_primary_email",
  "property_address",
  "property_apn",
  "property_county",
  "property_zoning",
  "property_legal_description",
  "property_year_built",
  "property_bedrooms",
  "property_bathrooms",
  "property_sqft",
  "property_lot_size",
  "property_property_type",
  "property_owner_name",
  "property_owner_mailing_address",
];

const FORMAT_OPTIONS: { value: AgreementValueFormat; label: string }[] = [
  { value: "none", label: "None (raw)" },
  { value: "currency", label: "Currency ($200,000)" },
  {
    value: "number_to_words_currency",
    label: "Currency + Words (($200,000) TWO HUNDRED THOUSAND DOLLARS)",
  },
  { value: "date_long", label: "Date — long (April 23, 2026)" },
  { value: "date_short", label: "Date — short (04/23/2026)" },
];

const COMPUTED_FNS: { value: AgreementComputedFn; label: string }[] = [
  { value: "today", label: "Today's date" },
  { value: "today_plus_days", label: "Today + N days" },
  { value: "today_minus_days", label: "Today − N days" },
  {
    value: "city_state_from_address",
    label: "City, State from address field",
  },
  { value: "subtract", label: "Subtract (A − B)" },
  { value: "multiply_percent", label: "Multiply by percent" },
];

type Props = {
  initial?: AgreementTemplate;
  onSave: (input: {
    name: string;
    agreement_type: string;
    google_doc_id: string;
    variables: AgreementVariable[];
  }) => void;
  onCancel: () => void;
  error: string | null;
  isPending: boolean;
};

export function TemplateEditor({
  initial,
  onSave,
  onCancel,
  error,
  isPending,
}: Props) {
  const [name, setName] = useState(initial?.name ?? "");
  const [agreementType, setAgreementType] = useState(
    initial?.agreement_type ?? "PSA"
  );
  const [googleDocId, setGoogleDocId] = useState(initial?.google_doc_id ?? "");
  const [variables, setVariables] = useState<AgreementVariable[]>(
    initial?.variables ?? []
  );

  function updateVar(index: number, patch: Partial<AgreementVariable>) {
    setVariables((v) => v.map((x, i) => (i === index ? { ...x, ...patch } : x)));
  }

  function addVariable() {
    setVariables((v) => [...v, { key: "", label: "", type: "text" }]);
  }

  function removeVariable(index: number) {
    setVariables((v) => v.filter((_, i) => i !== index));
  }

  function moveVariable(index: number, dir: -1 | 1) {
    setVariables((v) => {
      const next = [...v];
      const target = index + dir;
      if (target < 0 || target >= next.length) return v;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function submit() {
    if (!name.trim() || !agreementType.trim() || !googleDocId.trim()) return;
    onSave({
      name: name.trim(),
      agreement_type: agreementType.trim(),
      google_doc_id: googleDocId.trim(),
      variables,
    });
  }

  // For computed fn dropdowns that need to reference other keys
  const keyOptions = variables
    .map((v) => v.key)
    .filter((k) => k.trim().length > 0);

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-lg border border-dashed border-neutral-300 bg-white p-5 shadow-sm space-y-4">
        <h2 className="text-sm font-medium text-neutral-700">
          {initial ? "Edit Template" : "New Template"}
        </h2>

        <div>
          <label className="text-xs font-medium text-neutral-600">
            Template Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. PSA v4 (1 Seller)"
            className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="text-xs font-medium text-neutral-600">
            Agreement Type{" "}
            <span className="text-neutral-400">(appears in filename)</span>
          </label>
          <input
            type="text"
            value={agreementType}
            onChange={(e) => setAgreementType(e.target.value)}
            placeholder="e.g. PSA, LOI, Addendum"
            className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="text-xs font-medium text-neutral-600">
            Google Doc ID
          </label>
          <input
            type="text"
            value={googleDocId}
            onChange={(e) => setGoogleDocId(e.target.value)}
            placeholder="from docs.google.com/document/d/[THIS PART]/edit"
            className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-mono"
          />
          <p className="mt-1 text-xs text-neutral-500">
            Share the doc with the service account as Viewer first.
          </p>
        </div>
      </section>

      <section className="rounded-lg border border-dashed border-neutral-300 bg-white p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-neutral-700">Variables</h2>
          <button
            type="button"
            onClick={addVariable}
            className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-xs hover:bg-neutral-50"
          >
            + Add Variable
          </button>
        </div>

        {variables.length === 0 && (
          <div className="text-xs text-neutral-500 py-4 text-center">
            No variables yet. Every <code>{"{{placeholder}}"}</code> in your doc
            should have a matching variable here.
          </div>
        )}

        <div className="space-y-3">
          {variables.map((v, i) => (
            <VariableRow
              key={i}
              variable={v}
              keyOptions={keyOptions}
              onChange={(patch) => updateVar(i, patch)}
              onRemove={() => removeVariable(i)}
              onMoveUp={i > 0 ? () => moveVariable(i, -1) : undefined}
              onMoveDown={
                i < variables.length - 1 ? () => moveVariable(i, 1) : undefined
              }
            />
          ))}
        </div>
      </section>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </div>
      )}

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={isPending}
          className="rounded-md border border-[#c5cca8] bg-[#e8edda] px-3 py-1.5 text-sm hover:bg-[#dce3cb] disabled:opacity-50"
        >
          {isPending ? "Saving…" : "Save Template"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm hover:bg-neutral-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function VariableRow({
  variable,
  keyOptions,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
}: {
  variable: AgreementVariable;
  keyOptions: string[];
  onChange: (patch: Partial<AgreementVariable>) => void;
  onRemove: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}) {
  const hasConditional = !!variable.conditional;
  const supportsFormat =
    variable.type === "text" || variable.type === "computed";
  const supportsDefault =
    variable.type === "text" ||
    variable.type === "dropdown" ||
    variable.type === "checkbox";
  const supportsAutofill =
    variable.type === "text" || variable.type === "dropdown";

  function updateConditional(
    patch: Partial<NonNullable<AgreementVariable["conditional"]>>
  ) {
    onChange({
      conditional: {
        ...(variable.conditional ?? {
          showWhen: true,
          key: "",
          label: "",
          type: "text",
        }),
        ...patch,
      },
    });
  }

  function updateComputed(patch: Partial<AgreementComputedConfig>) {
    onChange({
      computed: {
        ...(variable.computed ?? { fn: "today" }),
        ...patch,
      },
    });
  }

  function handleTypeChange(next: AgreementVariable["type"]) {
    const patch: Partial<AgreementVariable> = {
      type: next,
      conditional: undefined,
      radioOptions: undefined,
      computed: undefined,
    };
    if (next === "checkbox") {
      patch.defaultValue = variable.defaultValue ?? false;
    } else if (next === "radio") {
      patch.radioOptions = [];
    } else if (next === "computed") {
      patch.computed = { fn: "today" };
    }
    onChange(patch);
  }

  return (
    <div className="rounded-md border border-neutral-200 bg-neutral-50 p-3 space-y-2">
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={variable.label}
          onChange={(e) => onChange({ label: e.target.value })}
          placeholder="Label (what the user sees)"
          className="flex-1 rounded-md border border-neutral-300 bg-white px-2 py-1 text-sm"
        />
        <select
          value={variable.type}
          onChange={(e) =>
            handleTypeChange(e.target.value as AgreementVariable["type"])
          }
          className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-sm"
        >
          <option value="text">Text</option>
          <option value="dropdown">Dropdown</option>
          <option value="checkbox">Checkbox</option>
          <option value="radio">Radio group</option>
          <option value="computed">Computed</option>
        </select>
        <div className="flex items-center gap-1">
          {onMoveUp && (
            <button
              type="button"
              onClick={onMoveUp}
              className="px-1.5 py-1 text-xs text-neutral-500 hover:text-neutral-800"
            >
              ↑
            </button>
          )}
          {onMoveDown && (
            <button
              type="button"
              onClick={onMoveDown}
              className="px-1.5 py-1 text-xs text-neutral-500 hover:text-neutral-800"
            >
              ↓
            </button>
          )}
          <button
            type="button"
            onClick={onRemove}
            className="px-1.5 py-1 text-xs text-red-600 hover:text-red-800"
          >
            ×
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex-1">
          <label className="text-[0.65rem] text-neutral-500">
            Placeholder key
          </label>
          <div className="flex items-center">
            <span className="text-xs text-neutral-400 font-mono mr-1">
              {"{{"}
            </span>
            <input
              type="text"
              value={variable.key}
              onChange={(e) => onChange({ key: snakeify(e.target.value) })}
              placeholder="snake_case_key"
              className="flex-1 rounded-md border border-neutral-300 bg-white px-2 py-1 text-sm font-mono"
            />
            <span className="text-xs text-neutral-400 font-mono ml-1">
              {"}}"}
            </span>
          </div>
        </div>
        {supportsAutofill && (
          <div className="flex-1">
            <label className="text-[0.65rem] text-neutral-500">
              Auto-fill from{" "}
              <span className="text-neutral-400">(optional)</span>
            </label>
            <select
              value={variable.autofillFrom ?? ""}
              onChange={(e) =>
                onChange({ autofillFrom: e.target.value || undefined })
              }
              className="w-full rounded-md border border-neutral-300 bg-white px-2 py-1 text-sm"
            >
              <option value="">— None —</option>
              {AUTOFILL_FIELDS.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {variable.type === "dropdown" && (
        <div>
          <label className="text-[0.65rem] text-neutral-500">
            Options (one per line)
          </label>
          <textarea
            value={(variable.options ?? []).join("\n")}
            onChange={(e) =>
              onChange({
                options: e.target.value
                  .split("\n")
                  .map((s) => s.trim())
                  .filter(Boolean),
              })
            }
            rows={3}
            className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-2 py-1 text-sm font-mono"
          />
        </div>
      )}

      {supportsDefault && (
        <div>
          <label className="text-[0.65rem] text-neutral-500">
            Default value{" "}
            <span className="text-neutral-400">(pre-fills the form)</span>
          </label>
          {variable.type === "checkbox" ? (
            <label className="mt-1 flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={variable.defaultValue === true}
                onChange={(e) =>
                  onChange({ defaultValue: e.target.checked })
                }
              />
              Checked by default
            </label>
          ) : (
            <input
              type="text"
              value={
                typeof variable.defaultValue === "string"
                  ? variable.defaultValue
                  : ""
              }
              onChange={(e) =>
                onChange({ defaultValue: e.target.value || undefined })
              }
              placeholder='e.g. "Randy Changpukdee d/b/a BT Investments"'
              className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-2 py-1 text-sm"
            />
          )}
        </div>
      )}

      {supportsFormat && (
        <div>
          <label className="text-[0.65rem] text-neutral-500">Format</label>
          <select
            value={variable.format ?? "none"}
            onChange={(e) =>
              onChange({
                format:
                  (e.target.value as AgreementValueFormat) === "none"
                    ? undefined
                    : (e.target.value as AgreementValueFormat),
              })
            }
            className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-2 py-1 text-sm"
          >
            {FORMAT_OPTIONS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </div>
      )}

      <label className="flex items-center gap-2 text-xs">
        <input
          type="checkbox"
          checked={variable.required ?? false}
          onChange={(e) => onChange({ required: e.target.checked })}
        />
        Required
      </label>

      {variable.type === "computed" && (
        <ComputedConfigEditor
          config={variable.computed ?? { fn: "today" }}
          keyOptions={keyOptions.filter((k) => k !== variable.key)}
          onChange={updateComputed}
        />
      )}

      {variable.type === "radio" && (
        <RadioOptionsEditor
          options={variable.radioOptions ?? []}
          onChange={(radioOptions) => onChange({ radioOptions })}
        />
      )}

      {variable.type === "checkbox" && (
        <div className="border-t border-dashed border-neutral-200 pt-2">
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={hasConditional}
              onChange={(e) =>
                onChange({
                  conditional: e.target.checked
                    ? {
                        showWhen: true,
                        key: "",
                        label: "",
                        type: "text",
                      }
                    : undefined,
                })
              }
            />
            Show extra input when this checkbox is checked
          </label>

          {hasConditional && variable.conditional && (
            <div className="mt-2 ml-6 space-y-2 border-l-2 border-neutral-200 pl-3">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={variable.conditional.key}
                  onChange={(e) =>
                    updateConditional({ key: snakeify(e.target.value) })
                  }
                  placeholder="conditional_key"
                  className="flex-1 rounded-md border border-neutral-300 bg-white px-2 py-1 text-sm font-mono"
                />
                <select
                  value={variable.conditional.type}
                  onChange={(e) =>
                    updateConditional({
                      type: e.target.value as "text" | "dropdown",
                    })
                  }
                  className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-sm"
                >
                  <option value="text">Text</option>
                  <option value="dropdown">Dropdown</option>
                </select>
              </div>
              <input
                type="text"
                value={variable.conditional.suffix ?? ""}
                onChange={(e) =>
                  updateConditional({ suffix: e.target.value })
                }
                placeholder='Suffix (e.g. "days after COE")'
                className="w-full rounded-md border border-neutral-300 bg-white px-2 py-1 text-sm"
              />
              {variable.conditional.type === "dropdown" && (
                <textarea
                  value={(variable.conditional.options ?? []).join("\n")}
                  onChange={(e) =>
                    updateConditional({
                      options: e.target.value
                        .split("\n")
                        .map((s) => s.trim())
                        .filter(Boolean),
                    })
                  }
                  rows={3}
                  placeholder="Dropdown options, one per line"
                  className="w-full rounded-md border border-neutral-300 bg-white px-2 py-1 text-sm font-mono"
                />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ComputedConfigEditor({
  config,
  keyOptions,
  onChange,
}: {
  config: AgreementComputedConfig;
  keyOptions: string[];
  onChange: (patch: Partial<AgreementComputedConfig>) => void;
}) {
  const needsDays =
    config.fn === "today_plus_days" || config.fn === "today_minus_days";
  const needsFromKey =
    config.fn === "city_state_from_address" ||
    config.fn === "subtract" ||
    config.fn === "multiply_percent";
  const needsSubtract = config.fn === "subtract";
  const needsPercent = config.fn === "multiply_percent";

  return (
    <div className="border-t border-dashed border-neutral-200 pt-2 space-y-2">
      <label className="text-[0.65rem] text-neutral-500">Logic</label>
      <select
        value={config.fn}
        onChange={(e) =>
          onChange({ fn: e.target.value as AgreementComputedFn })
        }
        className="w-full rounded-md border border-neutral-300 bg-white px-2 py-1 text-sm"
      >
        {COMPUTED_FNS.map((f) => (
          <option key={f.value} value={f.value}>
            {f.label}
          </option>
        ))}
      </select>

      {needsDays && (
        <div>
          <label className="text-[0.65rem] text-neutral-500">Days</label>
          <input
            type="number"
            value={config.days ?? 0}
            onChange={(e) => onChange({ days: Number(e.target.value) || 0 })}
            className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-2 py-1 text-sm"
          />
        </div>
      )}

      {needsFromKey && (
        <div>
          <label className="text-[0.65rem] text-neutral-500">
            {needsSubtract
              ? "From (A in A − B)"
              : needsPercent
                ? "From (value to multiply)"
                : "From (address field)"}
          </label>
          <select
            value={config.fromKey ?? ""}
            onChange={(e) =>
              onChange({ fromKey: e.target.value || undefined })
            }
            className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-2 py-1 text-sm"
          >
            <option value="">— Pick a variable —</option>
            {keyOptions.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </div>
      )}

      {needsSubtract && (
        <div>
          <label className="text-[0.65rem] text-neutral-500">
            Subtract (B in A − B)
          </label>
          <select
            value={config.subtractKey ?? ""}
            onChange={(e) =>
              onChange({ subtractKey: e.target.value || undefined })
            }
            className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-2 py-1 text-sm"
          >
            <option value="">— Pick a variable —</option>
            {keyOptions.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </div>
      )}

      {needsPercent && (
        <div>
          <label className="text-[0.65rem] text-neutral-500">
            Percent (e.g. 1 for 1%)
          </label>
          <input
            type="number"
            step="0.01"
            value={config.percent ?? 0}
            onChange={(e) =>
              onChange({ percent: Number(e.target.value) || 0 })
            }
            className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-2 py-1 text-sm"
          />
        </div>
      )}
    </div>
  );
}

function RadioOptionsEditor({
  options,
  onChange,
}: {
  options: AgreementRadioOption[];
  onChange: (next: AgreementRadioOption[]) => void;
}) {
  function updateOpt(index: number, patch: Partial<AgreementRadioOption>) {
    onChange(options.map((o, i) => (i === index ? { ...o, ...patch } : o)));
  }

  function addOpt() {
    onChange([...options, { label: "", placeholderKey: "" }]);
  }

  function removeOpt(index: number) {
    onChange(options.filter((_, i) => i !== index));
  }

  function updateCond(
    index: number,
    patch: Partial<NonNullable<AgreementRadioOption["conditional"]>>
  ) {
    const existing = options[index].conditional ?? {
      key: "",
      label: "",
      type: "text" as const,
    };
    updateOpt(index, { conditional: { ...existing, ...patch } });
  }

  return (
    <div className="border-t border-dashed border-neutral-200 pt-2 space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-[0.65rem] text-neutral-500">
          Options (exactly one can be selected)
        </label>
        <button
          type="button"
          onClick={addOpt}
          className="rounded-md border border-neutral-300 bg-white px-2 py-0.5 text-[0.65rem] hover:bg-neutral-50"
        >
          + Add Option
        </button>
      </div>

      {options.length === 0 && (
        <div className="text-xs text-neutral-500 py-2 text-center">
          No options yet.
        </div>
      )}

      {options.map((opt, i) => (
        <div
          key={i}
          className="rounded-md border border-neutral-200 bg-white p-2 space-y-2"
        >
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={opt.label}
              onChange={(e) => updateOpt(i, { label: e.target.value })}
              placeholder="Option label (user sees)"
              className="flex-1 rounded-md border border-neutral-300 bg-white px-2 py-1 text-sm"
            />
            <button
              type="button"
              onClick={() => removeOpt(i)}
              className="px-1.5 py-1 text-xs text-red-600 hover:text-red-800"
            >
              ×
            </button>
          </div>

          <div>
            <label className="text-[0.65rem] text-neutral-500">
              Placeholder key{" "}
              <span className="text-neutral-400">
                (fills with &quot;X&quot; when selected, &quot;&quot; otherwise)
              </span>
            </label>
            <div className="flex items-center">
              <span className="text-xs text-neutral-400 font-mono mr-1">
                {"{{"}
              </span>
              <input
                type="text"
                value={opt.placeholderKey}
                onChange={(e) =>
                  updateOpt(i, { placeholderKey: snakeify(e.target.value) })
                }
                placeholder="snake_case_key"
                className="flex-1 rounded-md border border-neutral-300 bg-white px-2 py-1 text-sm font-mono"
              />
              <span className="text-xs text-neutral-400 font-mono ml-1">
                {"}}"}
              </span>
            </div>
          </div>

          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={!!opt.conditional}
              onChange={(e) =>
                updateOpt(i, {
                  conditional: e.target.checked
                    ? { key: "", label: "", type: "text" }
                    : undefined,
                })
              }
            />
            Show extra input when this option is selected
          </label>

          {opt.conditional && (
            <div className="ml-6 space-y-2 border-l-2 border-neutral-200 pl-3">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={opt.conditional.key}
                  onChange={(e) =>
                    updateCond(i, { key: snakeify(e.target.value) })
                  }
                  placeholder="conditional_key"
                  className="flex-1 rounded-md border border-neutral-300 bg-white px-2 py-1 text-sm font-mono"
                />
                <select
                  value={opt.conditional.type}
                  onChange={(e) =>
                    updateCond(i, {
                      type: e.target.value as "text" | "dropdown",
                    })
                  }
                  className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-sm"
                >
                  <option value="text">Text</option>
                  <option value="dropdown">Dropdown</option>
                </select>
              </div>
              <input
                type="text"
                value={opt.conditional.label}
                onChange={(e) => updateCond(i, { label: e.target.value })}
                placeholder="Label (what the user sees)"
                className="w-full rounded-md border border-neutral-300 bg-white px-2 py-1 text-sm"
              />
              <input
                type="text"
                value={opt.conditional.suffix ?? ""}
                onChange={(e) => updateCond(i, { suffix: e.target.value })}
                placeholder='Suffix (optional, e.g. "days after COE")'
                className="w-full rounded-md border border-neutral-300 bg-white px-2 py-1 text-sm"
              />
              {opt.conditional.type === "dropdown" && (
                <textarea
                  value={(opt.conditional.options ?? []).join("\n")}
                  onChange={(e) =>
                    updateCond(i, {
                      options: e.target.value
                        .split("\n")
                        .map((s) => s.trim())
                        .filter(Boolean),
                    })
                  }
                  rows={3}
                  placeholder="Dropdown options, one per line"
                  className="w-full rounded-md border border-neutral-300 bg-white px-2 py-1 text-sm font-mono"
                />
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function snakeify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9_\s]/g, "")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_");
}
