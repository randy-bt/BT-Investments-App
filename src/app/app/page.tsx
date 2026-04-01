import { DashboardNotes } from "@/components/DashboardNotes";
import { HomeSearch } from "@/components/HomeSearch";
import { getAllEntityNames } from "@/actions/entity-lookup";
import { DashboardExpander } from "@/components/DashboardExpander";

export default async function AppHomePage() {
  const lookupResult = await getAllEntityNames();
  const entityLookup = lookupResult.success ? lookupResult.data : [];

  return (
    <main className="flex min-h-[calc(100vh-80px)] flex-col items-center px-6">
      {/* Hero section — vertically centered */}
      <div className="flex flex-1 flex-col items-center justify-center gap-6 w-full max-w-2xl">
        <div className="text-center">
          <p className="text-[0.65rem] text-neutral-400 mb-1">Version 1.3</p>
          <h1 className="text-5xl font-semibold tracking-tight text-neutral-900 sm:text-6xl">
            BT Investments
          </h1>
        </div>

        <div className="w-full">
          <HomeSearch />
        </div>

        {/* Expand arrow */}
        <DashboardExpander>
          <section className="w-full space-y-6 pt-2">
            <div className="grid w-full gap-6 md:grid-cols-2">
              <div className="rounded-lg border border-dashed border-neutral-300 bg-white p-4 shadow-sm">
                <h2 className="mb-2 text-sm font-medium text-neutral-700">
                  Acquisitions Dashboard
                </h2>
                <DashboardNotes module="acquisitions" entityLookup={entityLookup} compact />
              </div>
              <div className="rounded-lg border border-dashed border-neutral-300 bg-white p-4 shadow-sm">
                <h2 className="mb-2 text-sm font-medium text-neutral-700">
                  Dispositions Dashboard
                </h2>
                <DashboardNotes module="dispositions" entityLookup={entityLookup} compact />
              </div>
            </div>
            <div className="rounded-lg border border-dashed border-neutral-300 bg-white p-4 shadow-sm">
              <h2 className="mb-2 text-sm font-medium text-neutral-700">
                Active Marketing
              </h2>
              <DashboardNotes module="deals_marketing" linkGutter minHeight="6rem" compact />
            </div>
          </section>
        </DashboardExpander>
      </div>
    </main>
  );
}
