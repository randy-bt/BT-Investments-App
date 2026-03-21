import Link from "next/link";
import { DashboardNotes } from "@/components/DashboardNotes";
import { HomeSearch } from "@/components/HomeSearch";
import { LiveClock } from "@/components/LiveClock";

export default function AppHomePage() {
  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-10">
      <header className="flex items-center justify-between border-b border-dashed border-neutral-300 pb-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            BT Investments App
          </h1>
          <LiveClock />
        </div>
        <Link href="/" className="text-sm text-neutral-600 hover:underline">
          &larr; Back to public site
        </Link>
      </header>

      {/* Universal Search */}
      <HomeSearch />

      {/* Dashboards side by side */}
      <section className="grid gap-6 md:grid-cols-2">
        <div className="rounded-lg border border-dashed border-neutral-300 bg-white p-4 shadow-sm">
          <h2 className="mb-2 text-sm font-medium text-neutral-700">
            Acquisitions Dashboard
          </h2>
          <DashboardNotes module="acquisitions" />
        </div>
        <div className="rounded-lg border border-dashed border-neutral-300 bg-white p-4 shadow-sm">
          <h2 className="mb-2 text-sm font-medium text-neutral-700">
            Dispositions Dashboard
          </h2>
          <DashboardNotes module="dispositions" />
        </div>
      </section>

    </main>
  );
}
