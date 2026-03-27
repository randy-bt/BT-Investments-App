"use client";

import { useState, useTransition } from "react";
import { updateAppSetting } from "@/actions/app-settings";

export function CampaignKeyEditor({ initialValue }: { initialValue: string }) {
  const [value, setValue] = useState(initialValue);
  const [saved, setSaved] = useState(true);
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    startTransition(async () => {
      const result = await updateAppSetting("campaign_key", value);
      if (result.success) {
        setSaved(true);
      } else {
        alert("Could not save: " + result.error);
      }
    });
  }

  return (
    <div className="space-y-2">
      <textarea
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setSaved(false);
        }}
        rows={6}
        placeholder={"1803 = SS1 XL\n1805 = SS2 XL\n..."}
        className="w-full rounded border border-dashed border-neutral-200 bg-neutral-50 p-3 text-sm font-editable placeholder:text-neutral-300 resize-y"
      />
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending || saved}
          className="rounded bg-neutral-800 px-3 py-1 text-xs text-white hover:bg-neutral-700 disabled:opacity-40"
        >
          {isPending ? "Saving..." : "Save"}
        </button>
        {saved && !isPending && (
          <span className="text-xs text-neutral-400">Saved</span>
        )}
      </div>
    </div>
  );
}
