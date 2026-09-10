import type { Metadata } from "next";
import { safeNextPath } from "@/lib/internal-gate";

// The password screen for /internal/*. Lives OUTSIDE the /internal/ prefix
// on purpose: proxy.ts gates that prefix, so a form living inside it could
// never be reached to unlock itself.
export const metadata: Metadata = {
  title: { absolute: "Locked" },
  robots: { index: false, follow: false },
};

export default async function InternalLockedPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; e?: string }>;
}) {
  const { next, e } = await searchParams;
  const target = safeNextPath(next);

  const message =
    e === "rate"
      ? "Too many tries. Wait a minute and try again."
      : e === "bad"
        ? "That password is not right."
        : null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-100 px-6">
      <form
        action="/api/internal/unlock"
        method="POST"
        className="w-full max-w-xs border border-dashed border-neutral-400 bg-white p-8"
      >
        <input type="hidden" name="next" value={target} />

        <div className="font-mono text-[10px] tracking-[0.2em] uppercase text-neutral-500">
          BT Investments
        </div>
        <h1 className="mt-1 mb-6 font-mono text-sm text-neutral-800">Internal</h1>

        <label
          htmlFor="password"
          className="block font-mono text-[10px] tracking-[0.18em] uppercase text-neutral-500 mb-2"
        >
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoFocus
          autoComplete="current-password"
          className="w-full border border-neutral-300 px-3 py-2 font-mono text-sm text-neutral-900 focus:border-neutral-600 focus:outline-none"
        />

        {message && (
          <p role="alert" className="mt-3 font-mono text-[11px] text-red-700">
            {message}
          </p>
        )}

        <button
          type="submit"
          className="mt-5 w-full bg-neutral-900 px-3 py-2 font-mono text-[11px] tracking-[0.18em] uppercase text-white hover:bg-neutral-700 transition-colors"
        >
          Enter
        </button>
      </form>
    </div>
  );
}
