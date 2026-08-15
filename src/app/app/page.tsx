import Link from "next/link";
import { VersionLabel } from "@/components/VersionLabel";
import { HomeSearch } from "@/components/HomeSearch";
import { CollapsibleDashboard } from "@/components/CollapsibleDashboard";
import { getAllEntityNames } from "@/actions/entity-lookup";
import { getDashboardNote } from "@/actions/dashboard-notes";
import { getDispoQueue } from "@/actions/dispo";
import { DashboardExpander } from "@/components/DashboardExpander";
import { HomeBusinessStats } from "@/components/HomeBusinessStats";
import { getAuthUser } from "@/lib/auth";
import { getUpNextCount } from "@/actions/up-next";

// Pull live data on every request so the Up Next pill always reflects
// the actual queue state. Otherwise Next can serve a stale cached
// render with the previous count and trigger a hydration mismatch.
export const dynamic = "force-dynamic";

export default async function AppHomePage() {
  const [user, lookupResult, acqNote, aacqNote, dispNote, upNextCountRes] = await Promise.all([
    getAuthUser(),
    getAllEntityNames(),
    getDashboardNote("acquisitions"),
    getDashboardNote("acquisitions_b"),
    getDashboardNote("dispositions"),
    // getUpNextCount runs the same name-matching pass the queue uses,
    // so the pill badge always agrees with what /app/up-next shows.
    getUpNextCount(),
  ]);
  const dispoQueue = await getDispoQueue();
  const readyCount = dispoQueue.success ? dispoQueue.data.length : 0;
  const entityLookup = lookupResult.success ? lookupResult.data : [];

  const seed = (n: typeof acqNote) => ({
    content: n.success ? n.data.content : "",
    updatedAt: n.success ? n.data.updated_at : "",
  });
  const acqSeed = seed(acqNote);
  const aacqSeed = seed(aacqNote);
  const dispSeed = seed(dispNote);

  const upNextCount = upNextCountRes.success ? upNextCountRes.data : 0;

  return (
    <main className="flex min-h-[calc(100vh-80px)] flex-col items-center px-6">
      {user?.role === "admin" && (
        <div className="w-full max-w-5xl flex justify-center pt-4">
          <Link
            href="/app/up-next"
            className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-4 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50 transition-colors"
          >
            Up Next
            {upNextCount > 0 && (
              // Literal hex values so the dark-mode auto-overrides don't
              // collapse this into bg=text and make the count invisible.
              <span
                className="inline-flex items-center justify-center rounded-full px-1.5 min-w-[1.25rem] h-[1.125rem] text-[0.65rem] font-semibold tabular-nums"
                style={{ background: "#e5e5e5", color: "#525252" }}
              >
                {upNextCount}
              </span>
            )}
          </Link>
        </div>
      )}
      {/* Hero section — vertically centered */}
      <div className="flex flex-1 flex-col items-center justify-center gap-6 w-full max-w-5xl">
        <div className="text-center">
          <VersionLabel />
          <h1 className="text-5xl font-semibold tracking-tight text-neutral-900 sm:text-6xl">
            BT Investments
          </h1>
        </div>

        <div className="w-full max-w-2xl">
          <HomeSearch />
        </div>

        {/* Expand arrow */}
        <DashboardExpander>
          <section className="w-full space-y-6 pt-2 pb-12">
            <HomeBusinessStats />
            {/* All three boards in ONE container, each collapsed until asked
                for (Randy 8/13). AACQ and Dispositions used DashboardWithCount,
                which has no collapse at all and always rendered its editor -
                that is why they were open. They are CollapsibleDashboards now,
                which is what makes "collapsed by default" possible. Active
                Marketing was removed from this dropdown; the board itself is
                untouched and still lives on its own page. */}
            <div className="rounded-lg border border-dashed border-neutral-300 bg-white p-4 shadow-sm">
              <CollapsibleDashboard
                title="ACQ Dashboard"
                module="acquisitions"
                showFlagged
                entityLookup={entityLookup}
                compact
                initialContent={acqSeed.content}
                initialUpdatedAt={acqSeed.updatedAt}
              />
              <div className="mt-4 border-t border-dashed border-neutral-300 pt-4">
                <CollapsibleDashboard
                  title="AACQ Dashboard"
                  module="acquisitions_b"
                  showFlagged
                  entityLookup={entityLookup}
                  compact
                  initialContent={aacqSeed.content}
                  initialUpdatedAt={aacqSeed.updatedAt}
                />
              </div>
              <div className="mt-4 border-t border-dashed border-neutral-300 pt-4">
                <CollapsibleDashboard
                  title="DSP Dashboard"
                  module="dispositions"
                  entityLookup={entityLookup}
                  countMarker="🟢"
                  titleBadge={readyCount > 0 ? (
                    <span className="ml-2 inline-flex shrink-0 items-center gap-1 rounded-full bg-[#e8edda] px-2 py-0.5 text-[11px] font-semibold leading-none text-[#46683F] ring-1 ring-inset ring-[#c5cca8] dark:bg-[#3a4030] dark:text-[#c5cca8] dark:ring-[#5c6e2d]">
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M4 22V4" />
                        <path d="M4 4h13l-2.5 4L17 12H4" />
                      </svg>
                      <span className="tabular-nums">{readyCount}</span>
                    </span>
                  ) : undefined}
                  compact
                  initialContent={dispSeed.content}
                  initialUpdatedAt={dispSeed.updatedAt}
                />
              </div>
            </div>
          </section>
        </DashboardExpander>
      </div>
    </main>
  );
}
