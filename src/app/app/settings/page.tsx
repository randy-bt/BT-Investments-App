import Link from "next/link";
import { UserManagement } from "@/components/UserManagement";
import { ScriptEditor } from "@/components/ScriptEditor";
import { getUsers } from "@/actions/users";
import { getAppSetting } from "@/actions/app-settings";
import { getScripts } from "@/actions/scripts";
import { CampaignKeyEditor } from "./campaign-key-editor";
import { CollapsibleCard } from "./collapsible-card";
import { NewsRefreshButton } from "./news-refresh-button";
import { UsageMonitor } from "./usage-monitor";
import { BusinessStats } from "./business-stats";
import { MarketStatsEditor } from "./market-stats-editor";
import { getMarketStats } from "@/actions/market-stats";
import { getUsageStats } from "@/actions/usage-stats";

export default async function AppSettingsPage() {
  const [result, campaignKeyResult, scriptsResult, marketStatsResult, usageStatsResult] = await Promise.all([
    getUsers(),
    getAppSetting("campaign_key"),
    getScripts(),
    getMarketStats(),
    getUsageStats(),
  ]);
  const campaignKey = campaignKeyResult.success ? campaignKeyResult.data : "";
  const scripts = scriptsResult.success ? scriptsResult.data : null;
  const usageStats = usageStatsResult.success ? usageStatsResult.data : null;

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-8 px-6 py-10">
      <header className="flex items-center justify-between border-b border-dashed border-neutral-300 pb-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Settings</h1>
          <p className="text-sm text-neutral-600">
            App preferences and user management
          </p>
        </div>
      </header>

      <CollapsibleCard title="Usage Monitor" defaultOpen>
        <UsageMonitor initialStats={usageStats} />
      </CollapsibleCard>

      <CollapsibleCard title="Business Stats" defaultOpen>
        <BusinessStats initialStats={usageStats} />
      </CollapsibleCard>

      <section className="space-y-6">
        <CollapsibleCard title="Team Members">
          {result.success ? (
            <UserManagement initialUsers={result.data} />
          ) : (
            <p className="text-sm text-neutral-500">{result.error}</p>
          )}
        </CollapsibleCard>

        <CollapsibleCard title="Website">
          <Link
            href="/app/form-submissions"
            className="rounded-md border border-neutral-400 bg-neutral-50 px-3 py-1.5 text-sm hover:bg-neutral-100"
          >
            Form Submissions
          </Link>
        </CollapsibleCard>

        <CollapsibleCard title="Campaign Key">
          <CampaignKeyEditor initialValue={campaignKey} />
        </CollapsibleCard>

        <CollapsibleCard title="News">
          <NewsRefreshButton />
        </CollapsibleCard>

        <CollapsibleCard title="Market Stats">
          <MarketStatsEditor
            initialStats={marketStatsResult.success ? marketStatsResult.data : []}
          />
        </CollapsibleCard>

        <CollapsibleCard title="Call Scripts">
          {scripts ? (
            <ScriptEditor initialScripts={scripts} />
          ) : (
            <p className="text-sm text-neutral-500">Failed to load scripts.</p>
          )}
        </CollapsibleCard>
      </section>

      {/* Placeholder */}
      <div className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50 p-8 text-center">
        <p className="text-sm text-neutral-400">
          More settings coming soon...
        </p>
      </div>
    </main>
  );
}
