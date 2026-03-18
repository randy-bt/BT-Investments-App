import Link from "next/link";
import { AppBackLink } from "@/components/AppBackLink";

export default function SmsCampaignsPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-8 px-6 py-10">
      <header className="flex items-center justify-between border-b border-dashed border-neutral-300 pb-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            BT Investments App – Campaigns
          </h1>
          <p className="text-sm text-neutral-600">
            app.btinvestments.co/sms-marketing/campaigns
          </p>
        </div>
        <AppBackLink href="/app/sms-marketing" />
      </header>

      <section className="space-y-6 rounded-lg border border-dashed border-neutral-300 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap justify-center gap-3 text-sm">
          <Link
            href="#"
            className="rounded-md border border-neutral-400 bg-neutral-50 px-4 py-2 hover:bg-neutral-100"
          >
            Create New Campaign →
          </Link>
          <Link
            href="#"
            className="rounded-md border border-neutral-400 bg-neutral-50 px-4 py-2 hover:bg-neutral-100"
          >
            View Templates →
          </Link>
        </div>

        <div className="space-y-2 pt-4">
          <p className="text-sm font-medium text-neutral-700">
            All Campaigns (mock layout)
          </p>
          <div className="rounded-md border border-dashed border-neutral-400 bg-neutral-50 p-4 text-sm text-neutral-700">
            <div className="flex border-b border-neutral-300 pb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
              <span className="w-1/3">Campaign Name</span>
              <span className="w-1/3">Template</span>
              <span className="w-1/3">Sent Date / Time</span>
            </div>
            <div className="mt-3 flex text-xs text-neutral-700">
              <span className="w-1/3">Q2 Seller Reactivation</span>
              <span className="w-1/3">Seller Reactivation – Short</span>
              <span className="w-1/3">2026-04-15 3:45 PM</span>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

