"use client";

import { useState, useEffect } from "react";

type Status = "idle" | "fetching" | "scoring" | "saving" | "done" | "error";

const STEPS: { key: Status; label: string; pct: number }[] = [
  { key: "fetching", label: "Fetching articles from RSS feeds & news APIs...", pct: 30 },
  { key: "scoring", label: "Scoring articles for relevance with AI...", pct: 65 },
  { key: "saving", label: "Saving articles to database...", pct: 90 },
];

export function NewsRefreshButton() {
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");
  const [elapsed, setElapsed] = useState(0);

  // Simulate progress steps based on elapsed time
  // Real refresh takes ~30-90s depending on article count
  useEffect(() => {
    if (status !== "fetching" && status !== "scoring" && status !== "saving") return;
    const interval = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(interval);
  }, [status]);

  useEffect(() => {
    if (status === "idle" || status === "done" || status === "error") return;
    if (elapsed >= 8 && status === "fetching") setStatus("scoring");
    if (elapsed >= 25 && status === "scoring") setStatus("saving");
  }, [elapsed, status]);

  async function handleRefresh() {
    setStatus("fetching");
    setMessage("");
    setElapsed(0);

    try {
      const res = await fetch("/api/news/refresh", { method: "POST" });
      const data = await res.json();

      if (!res.ok) {
        setStatus("error");
        setMessage(data.error || "Refresh failed");
        return;
      }

      setStatus("done");
      setMessage(
        data.added > 0
          ? `${data.added} new article${data.added === 1 ? "" : "s"} added.`
          : "No new articles found — everything is up to date."
      );
    } catch {
      setStatus("error");
      setMessage("Network error. Please try again.");
    }
  }

  const isLoading = status === "fetching" || status === "scoring" || status === "saving";
  const currentStep = STEPS.find((s) => s.key === status);
  const pct = status === "done" ? 100 : currentStep?.pct ?? 0;

  return (
    <div className="space-y-4">
      <p className="text-sm text-neutral-600">
        News automatically refreshes once daily at 8:00 AM Pacific. Use the button below to trigger a manual refresh.
      </p>

      <button
        type="button"
        onClick={handleRefresh}
        disabled={isLoading}
        className="rounded-md border border-neutral-400 bg-neutral-50 px-4 py-1.5 text-sm hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isLoading ? "Refreshing..." : "Refresh News Now"}
      </button>

      {(isLoading || status === "done" || status === "error") && (
        <div className="space-y-2">
          {/* Progress bar */}
          <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-200">
            <div
              className={`h-full rounded-full transition-all duration-700 ease-out ${
                status === "error"
                  ? "bg-red-500"
                  : status === "done"
                    ? "bg-green-500"
                    : "bg-blue-500"
              }`}
              style={{ width: `${pct}%` }}
            />
          </div>

          {/* Status text */}
          <div className="flex items-center gap-2">
            {isLoading && (
              <svg className="h-4 w-4 animate-spin text-blue-500" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
            {status === "done" && (
              <svg className="h-4 w-4 text-green-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            )}
            {status === "error" && (
              <svg className="h-4 w-4 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            )}
            <p className={`text-sm ${
              status === "error" ? "text-red-600" : status === "done" ? "text-green-700" : "text-neutral-600"
            }`}>
              {isLoading && currentStep ? currentStep.label : message}
            </p>
            {isLoading && (
              <span className="ml-auto text-xs text-neutral-400">{elapsed}s</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
