"use client";

import { useState } from "react";

export function HtmlViewerClient({ html }: { html: string }) {
  const [tab, setTab] = useState<"code" | "preview">("code");
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(html);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex gap-1 rounded-md border border-neutral-300 p-0.5">
          <button
            type="button"
            onClick={() => setTab("code")}
            className={`rounded px-3 py-1 text-xs ${
              tab === "code" ? "bg-neutral-800 text-white" : "text-neutral-600"
            }`}
          >
            Code
          </button>
          <button
            type="button"
            onClick={() => setTab("preview")}
            className={`rounded px-3 py-1 text-xs ${
              tab === "preview" ? "bg-neutral-800 text-white" : "text-neutral-600"
            }`}
          >
            Preview
          </button>
        </div>
        {tab === "code" && (
          <button
            type="button"
            onClick={handleCopy}
            className="rounded border border-neutral-300 px-3 py-1 text-xs hover:bg-neutral-50"
          >
            {copied ? "Copied!" : "Copy HTML"}
          </button>
        )}
      </div>

      {tab === "code" ? (
        <pre className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 text-xs text-neutral-700 whitespace-pre-wrap break-all max-h-[80vh] overflow-y-auto">
          {html}
        </pre>
      ) : (
        <iframe
          srcDoc={html}
          sandbox="allow-same-origin"
          className="w-full h-[80vh] rounded-lg border border-neutral-200 bg-white"
        />
      )}
    </div>
  );
}
