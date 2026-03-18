import Link from "next/link";
import { AppBackLink } from "@/components/AppBackLink";

export default function SmsMarketingPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-8 px-6 py-10">
      <header className="flex items-center justify-between border-b border-dashed border-neutral-300 pb-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            BT Investments App – SMS Marketing
          </h1>
          <p className="text-sm text-neutral-600">
            app.btinvestments.co/sms-marketing
          </p>
        </div>
        <AppBackLink href="/app" />
      </header>

      <section className="space-y-4 rounded-lg border border-dashed border-neutral-300 bg-white p-6 shadow-sm">
        <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
          <Link
            href="/app/sms-marketing/campaigns"
            className="rounded-md border border-neutral-400 bg-neutral-50 px-3 py-2 hover:bg-neutral-100"
          >
            Campaigns →
          </Link>
          <Link
            href="/app/sms-marketing/inbox"
            className="rounded-md border border-neutral-400 bg-neutral-50 px-3 py-2 hover:bg-neutral-100"
          >
            Inbox →
          </Link>
          <Link
            href="/app/sms-marketing/settings"
            className="rounded-md border border-neutral-400 bg-neutral-50 px-3 py-2 hover:bg-neutral-100"
          >
            Settings →
          </Link>
        </div>
      </section>
    </main>
  );
}

