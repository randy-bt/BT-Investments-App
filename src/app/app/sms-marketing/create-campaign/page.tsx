import { AppBackLink } from "@/components/AppBackLink";

export default function SmsCreateCampaignPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-8 px-6 py-10">
      <header className="flex items-center justify-between border-b border-dashed border-neutral-300 pb-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            BT Investments App – Create Campaign
          </h1>
          <p className="text-sm text-neutral-600">
            app.btinvestments.co/sms-marketing/create-campaign
          </p>
        </div>
        <AppBackLink href="/app/sms-marketing" />
      </header>

      <section className="rounded-lg border border-dashed border-neutral-300 bg-white p-6 text-sm text-neutral-500 shadow-sm">
        [ Placeholder for campaign creation screen – title, message content,
        audience selection, schedule, etc. ]
      </section>
    </main>
  );
}

