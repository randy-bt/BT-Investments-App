import { AppBackLink } from "@/components/AppBackLink";
import { LeadForm } from "@/components/LeadForm";
import { getAppSetting } from "@/actions/app-settings";

export default async function NewLeadPage() {
  const campaignKeyResult = await getAppSetting("campaign_key");
  const campaignKey = campaignKeyResult.success ? campaignKeyResult.data : "";

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-8 px-6 py-10">
      <header className="flex items-center justify-between border-b border-dashed border-neutral-300 pb-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Onboarding</h1>
          <p className="text-sm text-neutral-600">
            Add a new lead record
          </p>
        </div>
        <AppBackLink href="/app/acquisitions" />
      </header>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-6">
        <section className="rounded-lg border border-dashed border-neutral-300 bg-white p-6 shadow-sm">
          <LeadForm />
        </section>

        {campaignKey && (
          <aside className="md:w-48 md:shrink-0">
            <div className="rounded-lg border border-dashed border-neutral-200 bg-neutral-50 px-4 py-3 shadow-sm">
              <h3 className="text-[0.65rem] font-medium text-neutral-400 mb-1.5">
                Campaign Key
              </h3>
              <pre className="text-xs text-neutral-600 font-editable whitespace-pre-wrap leading-relaxed">
                {campaignKey}
              </pre>
            </div>
          </aside>
        )}
      </div>
    </main>
  );
}
