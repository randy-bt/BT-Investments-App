"use client";

// The ⓘ on the Investor Calls card (Randy, Oct 2 2026). Replaces the
// "Aldo's follow-ups" caption: a circled i that opens the instructions.
//
// Randy edits and saves; Aldo and anyone else reads. The read-only textarea
// is a courtesy - setDispoCallsInstructions enforces admin server-side, so
// a non-admin cannot save by calling the action directly.

import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import {
  getDispoCallsInstructions,
  setDispoCallsInstructions,
} from "@/actions/dispo-instructions";

export function CallsInstructions() {
  const { isAdmin } = useAuth();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!open || loaded) return;
    getDispoCallsInstructions().then((r) => {
      if (r.success) setText(r.data.text);
      else setError(r.error);
      setLoaded(true);
    });
  }, [open, loaded]);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const r = await setDispoCallsInstructions(text);
      if (!r.success) { setError(r.error); return; }
      setOpen(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Instructions for this board"
        title="Instructions"
        className="flex h-5 w-5 items-center justify-center rounded-full border border-neutral-400 text-[11px] font-semibold leading-none text-neutral-500 hover:border-neutral-600 hover:text-neutral-800 dark:border-neutral-500 dark:text-neutral-400 dark:hover:text-neutral-100"
      >
        i
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-lg border border-dashed border-neutral-300 bg-white p-4 shadow-lg dark:border-neutral-600 dark:bg-neutral-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold">Investor Calls — instructions</h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            {!loaded ? (
              <p className="py-6 text-center text-xs text-neutral-400">Loading…</p>
            ) : isAdmin ? (
              <>
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  rows={10}
                  className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm font-editable dark:border-neutral-600 dark:bg-neutral-800"
                  placeholder="What should Aldo do with this board?"
                />
                <div className="mt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="text-xs text-neutral-500 hover:underline"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={save}
                    disabled={saving}
                    className="rounded-md bg-[#5c6e2d] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#4d5c26] disabled:opacity-50"
                  >
                    {saving ? "Saving…" : "Save"}
                  </button>
                </div>
              </>
            ) : text.trim() ? (
              <p className="whitespace-pre-wrap text-sm text-neutral-700 dark:text-neutral-200">{text}</p>
            ) : (
              <p className="text-sm text-neutral-400">No instructions yet.</p>
            )}

            {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
          </div>
        </div>
      )}
    </>
  );
}
