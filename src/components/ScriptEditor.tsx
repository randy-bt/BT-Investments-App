"use client";

import { useState, useTransition } from "react";
import { updateAppSetting } from "@/actions/app-settings";

type Script = { title: string; lines: string[] };
type ScriptMap = Record<string, Script>;

const LABELS: Record<string, string> = {
  acquisitions: "Acquisitions",
  dispositions: "Dispositions",
  agent_outreach: "Agent Outreach",
  investor_outreach: "Investor Outreach",
};

function scriptToText(script: Script): string {
  return script.lines.join("\n");
}

function textToLines(text: string): string[] {
  return text.split("\n");
}

export function ScriptEditor({ initialScripts }: { initialScripts: ScriptMap }) {
  const [scripts, setScripts] = useState<ScriptMap>(initialScripts);
  const [activeTab, setActiveTab] = useState(Object.keys(initialScripts)[0]);
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  const script = scripts[activeTab];

  function updateText(value: string) {
    setSaved(false);
    setScripts((prev) => ({
      ...prev,
      [activeTab]: { ...prev[activeTab], lines: textToLines(value) },
    }));
  }

  function save() {
    startTransition(async () => {
      const result = await updateAppSetting(
        `script_${activeTab}`,
        JSON.stringify(scripts[activeTab])
      );
      if (result.success) setSaved(true);
    });
  }

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex gap-1 border-b border-neutral-200">
        {Object.keys(scripts).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => { setActiveTab(key); setSaved(false); }}
            className={`px-3 py-1.5 text-xs rounded-t transition-colors ${
              activeTab === key
                ? "bg-white border border-b-white border-neutral-200 -mb-px font-medium text-neutral-800"
                : "text-neutral-500 hover:text-neutral-700"
            }`}
          >
            {LABELS[key] ?? key}
          </button>
        ))}
      </div>

      {/* Single textarea per script */}
      <textarea
        value={scriptToText(script)}
        onChange={(e) => updateText(e.target.value)}
        rows={14}
        className="w-full rounded border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm font-editable outline-none focus:border-neutral-400 resize-y leading-relaxed"
        placeholder="Enter your call script here..."
      />

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={isPending}
          className="rounded bg-neutral-800 px-4 py-1.5 text-xs text-white hover:bg-neutral-700 disabled:opacity-50"
        >
          {isPending ? "Saving..." : "Save Script"}
        </button>
        {saved && (
          <span className="text-xs text-green-600">Saved</span>
        )}
      </div>
    </div>
  );
}
