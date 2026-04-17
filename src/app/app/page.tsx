import { VersionLabel } from "@/components/VersionLabel";
import { DashboardNotes } from "@/components/DashboardNotes";
import { HomeSearch } from "@/components/HomeSearch";
import { CollapsibleDashboard } from "@/components/CollapsibleDashboard";
import { DashboardWithCount } from "@/components/DashboardWithCount";
import { getAllEntityNames } from "@/actions/entity-lookup";
import { DashboardExpander } from "@/components/DashboardExpander";
import { HomeBusinessStats } from "@/components/HomeBusinessStats";

export default async function AppHomePage() {
  const lookupResult = await getAllEntityNames();
  const entityLookup = lookupResult.success ? lookupResult.data : [];

  return (
    <main className="flex min-h-[calc(100vh-80px)] flex-col items-center px-6 pb-12">
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
          <section className="w-full space-y-6 pt-2">
            <HomeBusinessStats />
            <div className="rounded-lg border border-dashed border-neutral-300 bg-white p-4 shadow-sm">
              <h2 className="mb-2 text-sm font-medium text-neutral-700">
                Active Marketing
              </h2>
              <DashboardNotes module="deals_marketing" linkGutter minHeight="4.5rem" compact />
            </div>
            <div className="grid w-full gap-6 md:grid-cols-2">
              <div className="rounded-lg border border-dashed border-neutral-300 bg-white p-4 shadow-sm">
                <CollapsibleDashboard
                  title="ACQ Dashboard"
                  module="acquisitions"
                  entityLookup={entityLookup}
                  compact
                />
                <div className="border-t border-dashed border-neutral-300 mt-4 pt-4">
                  <DashboardWithCount
                    title="AACQ Dashboard"
                    module="acquisitions_b"
                    entityLookup={entityLookup}
                    compact
                    titleClassName="text-sm font-medium text-neutral-700"
                  />
                </div>
              </div>
              <div className="rounded-lg border border-dashed border-neutral-300 bg-white p-4 shadow-sm">
                <DashboardWithCount
                  title="Dispositions Dashboard"
                  module="dispositions"
                  entityLookup={entityLookup}
                  compact
                  titleClassName="text-sm font-medium text-neutral-700"
                />
              </div>
            </div>
          </section>
        </DashboardExpander>
      </div>
    </main>
  );
}
