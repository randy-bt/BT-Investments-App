"use client";

import { useState, useTransition } from "react";
import {
  createAgreementTemplate,
  deleteAgreementTemplate,
  updateAgreementTemplate,
} from "@/actions/agreements";
import type { AgreementTemplate, AgreementVariable } from "@/lib/types";
import { TemplateEditor } from "./template-editor";

type Mode = { kind: "list" } | { kind: "new" } | { kind: "edit"; id: string };

export function AdminClient({ initial }: { initial: AgreementTemplate[] }) {
  const [templates, setTemplates] = useState(initial);
  const [mode, setMode] = useState<Mode>({ kind: "list" });
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const editing =
    mode.kind === "edit" ? templates.find((t) => t.id === mode.id) : null;

  function onSave(input: {
    name: string;
    agreement_type: string;
    google_doc_id: string;
    variables: AgreementVariable[];
  }) {
    setError(null);
    startTransition(async () => {
      if (mode.kind === "new") {
        const res = await createAgreementTemplate(input);
        if (!res.success) {
          setError(res.error);
          return;
        }
        setTemplates((t) => [...t, res.data]);
        setMode({ kind: "list" });
      } else if (mode.kind === "edit") {
        const res = await updateAgreementTemplate(mode.id, input);
        if (!res.success) {
          setError(res.error);
          return;
        }
        setTemplates((t) =>
          t.map((x) => (x.id === mode.id ? res.data : x))
        );
        setMode({ kind: "list" });
      }
    });
  }

  function onDelete(id: string) {
    if (!confirm("Archive this template? It'll be hidden but preserved.")) return;
    startTransition(async () => {
      const res = await deleteAgreementTemplate(id);
      if (res.success) {
        setTemplates((t) =>
          t.map((x) => (x.id === id ? { ...x, active: false } : x))
        );
      }
    });
  }

  function onReactivate(id: string) {
    startTransition(async () => {
      const res = await updateAgreementTemplate(id, { active: true });
      if (res.success) {
        setTemplates((t) => t.map((x) => (x.id === id ? res.data : x)));
      }
    });
  }

  if (mode.kind === "new") {
    return (
      <TemplateEditor
        onSave={onSave}
        onCancel={() => setMode({ kind: "list" })}
        error={error}
        isPending={isPending}
      />
    );
  }

  if (mode.kind === "edit" && editing) {
    return (
      <TemplateEditor
        initial={editing}
        onSave={onSave}
        onCancel={() => setMode({ kind: "list" })}
        error={error}
        isPending={isPending}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setMode({ kind: "new" })}
          className="rounded-md border border-[#c5cca8] bg-[#e8edda] px-3 py-1.5 text-sm hover:bg-[#dce3cb]"
        >
          + New Template
        </button>
      </div>

      <section className="rounded-lg border border-dashed border-neutral-300 bg-white p-4 shadow-sm">
        {templates.length === 0 ? (
          <div className="text-sm text-neutral-500 py-8 text-center">
            No templates yet.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-dashed border-neutral-300 text-left text-xs text-neutral-500">
                <th className="py-2 font-medium">Name</th>
                <th className="py-2 font-medium">Type</th>
                <th className="py-2 font-medium">Status</th>
                <th className="py-2 pl-8 font-medium w-48">Actions</th>
              </tr>
            </thead>
            <tbody>
              {templates.map((t) => (
                <tr key={t.id} className="border-b border-neutral-100">
                  <td className="py-2">{t.name}</td>
                  <td className="py-2 text-neutral-600">{t.agreement_type}</td>
                  <td className="py-2 text-neutral-600">
                    {t.active ? "Active" : "Archived"}
                  </td>
                  <td className="py-2 pl-8">
                    <div className="flex items-center gap-6">
                      <button
                        type="button"
                        onClick={() => setMode({ kind: "edit", id: t.id })}
                        className="text-xs text-neutral-700 underline hover:text-neutral-900"
                      >
                        Edit
                      </button>
                      {t.active ? (
                        <button
                          type="button"
                          onClick={() => onDelete(t.id)}
                          className="text-xs text-red-600 hover:text-red-800"
                        >
                          Archive
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onReactivate(t.id)}
                          className="text-xs text-neutral-700 underline"
                        >
                          Reactivate
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
