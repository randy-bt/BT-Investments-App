import Link from "next/link";
import { notFound } from "next/navigation";
import { getSignalSubmission } from "@/actions/signal";

// Signal submission detail (handoff 001): full message, voice note player,
// image previews, file links. The notification email links directly here.

export const metadata = { title: "Signal Submission" };

function sigLabel(n: number) {
  return `SIG-${String(n).padStart(3, "0")}`;
}

function fmtDuration(seconds?: number) {
  if (!seconds) return "";
  return ` (${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")})`;
}

export default async function SignalSubmissionDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await getSignalSubmission(id);
  if (!result.success) notFound();
  const s = result.data;

  const voice = s.attachmentsWithUrls.filter((a) => a.kind === "voice");
  const images = s.attachmentsWithUrls.filter((a) => a.kind === "image");
  const files = s.attachmentsWithUrls.filter((a) => a.kind === "file");

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-10">
      <header className="border-b border-dashed border-neutral-300 pb-4 dark:border-neutral-700">
        <Link
          href="/app/signals"
          className="text-xs text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
        >
          &larr; All submissions
        </Link>
        <h1 className="mt-2 text-xl font-semibold tracking-tight">
          {sigLabel(s.sig_number)}
          {(s.name || s.business_name) && (
            <span className="ml-2 font-normal text-neutral-600 dark:text-neutral-300">
              {[s.name, s.business_name].filter(Boolean).join(", ")}
            </span>
          )}
        </h1>
        <p className="mt-1 text-xs text-neutral-400 dark:text-neutral-500">
          {new Date(s.created_at).toLocaleString("en-US", {
            timeZone: "America/Los_Angeles",
            dateStyle: "medium",
            timeStyle: "short",
          })}
        </p>
      </header>

      {/* Contact */}
      <section className="rounded-md border border-neutral-200 bg-white px-4 py-3 text-sm dark:border-neutral-700 dark:bg-neutral-900">
        <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
          <div>
            <span className="text-neutral-400 dark:text-neutral-500">Email: </span>
            {s.email ? (
              <a href={`mailto:${s.email}`} className="text-neutral-800 underline-offset-2 hover:underline dark:text-neutral-200">
                {s.email}
              </a>
            ) : (
              "-"
            )}
          </div>
          <div>
            <span className="text-neutral-400 dark:text-neutral-500">Phone: </span>
            <span className="text-neutral-800 dark:text-neutral-200">{s.phone || "-"}</span>
          </div>
        </div>
      </section>

      {/* Message */}
      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
          Message
        </h2>
        <div className="rounded-md border border-neutral-200 bg-white px-4 py-3 text-sm whitespace-pre-wrap text-neutral-800 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200">
          {s.message_text || "(no typed message)"}
        </div>
      </section>

      {/* Voice notes */}
      {voice.length > 0 && (
        <section>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
            Voice note
          </h2>
          {voice.map((a) => (
            <div
              key={a.storage_path}
              className="rounded-md border border-neutral-200 bg-white px-4 py-3 dark:border-neutral-700 dark:bg-neutral-900"
            >
              {a.url ? (
                <audio controls preload="metadata" src={a.url} className="w-full" />
              ) : (
                <p className="text-sm text-neutral-500">Could not load the audio.</p>
              )}
              <p className="mt-1 text-xs text-neutral-400 dark:text-neutral-500">
                {a.original_name}
                {fmtDuration(a.duration_seconds)}
              </p>
            </div>
          ))}
        </section>
      )}

      {/* Images */}
      {images.length > 0 && (
        <section>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
            Photos
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {images.map((a) =>
              a.url ? (
                <a key={a.storage_path} href={a.url} target="_blank" rel="noopener noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={a.url}
                    alt={a.original_name}
                    className="h-40 w-full rounded-md border border-neutral-200 object-cover dark:border-neutral-700"
                  />
                </a>
              ) : null
            )}
          </div>
        </section>
      )}

      {/* Files */}
      {files.length > 0 && (
        <section>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
            Files
          </h2>
          <div className="flex flex-col gap-1">
            {files.map((a) => (
              <a
                key={a.storage_path}
                href={a.url ?? "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-md border border-neutral-200 bg-white px-4 py-2 text-sm text-neutral-800 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
              >
                {a.original_name}
                <span className="ml-2 text-xs text-neutral-400">
                  {(a.size / 1024 / 1024).toFixed(1)}MB
                </span>
              </a>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
