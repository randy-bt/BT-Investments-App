import Link from "next/link";
import { listSignalSubmissions } from "@/actions/signal";

// Minimal internal view for Signal intake submissions (handoff 001).
// This is where the notification email's link lands. Nothing fancy:
// newest first, click through for the full message + attachments.

export const metadata = { title: "Signal Submissions" };

function sigLabel(n: number) {
  return `SIG-${String(n).padStart(3, "0")}`;
}

export default async function SignalSubmissionsPage() {
  const result = await listSignalSubmissions();

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-10">
      <header className="border-b border-dashed border-neutral-300 pb-4 dark:border-neutral-700">
        <h1 className="text-xl font-semibold tracking-tight">Signal Submissions</h1>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          Everything sent through the /signal intake, newest first.
        </p>
      </header>

      {!result.success ? (
        <p className="text-sm text-neutral-500">{result.error}</p>
      ) : result.data.length === 0 ? (
        <p className="rounded-md border border-dashed border-neutral-300 px-4 py-6 text-center text-sm text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">
          No submissions yet.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {result.data.map((s) => (
            <Link
              key={s.id}
              href={`/app/signals/${s.id}`}
              className="rounded-md border border-neutral-200 bg-white px-4 py-3 transition-colors hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:hover:bg-neutral-800"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                  {sigLabel(s.sig_number)}
                  {(s.name || s.business_name) && (
                    <span className="ml-2 font-normal text-neutral-600 dark:text-neutral-300">
                      {[s.name, s.business_name].filter(Boolean).join(", ")}
                    </span>
                  )}
                </span>
                <span className="shrink-0 text-xs text-neutral-400 dark:text-neutral-500">
                  {new Date(s.created_at).toLocaleDateString("en-US", {
                    timeZone: "America/Los_Angeles",
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              <div className="mt-1 flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
                <span className="truncate">
                  {s.message_text
                    ? s.message_text.slice(0, 120)
                    : "(no typed message)"}
                </span>
                {s.attachments?.length > 0 && (
                  <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                    {s.attachments.some((a) => a.kind === "voice") ? "🎙 " : ""}
                    {s.attachments.length} attachment{s.attachments.length === 1 ? "" : "s"}
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
