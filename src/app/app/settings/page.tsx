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
import { JvActivityLog } from "./jv-activity-log";
import { getAuthUser } from "@/lib/auth";

export default async function AppSettingsPage() {
  const [result, campaignKeyResult, scriptsResult, marketStatsResult, usageStatsResult, user, cronErrorResult] = await Promise.all([
    getUsers(),
    getAppSetting("campaign_key"),
    getScripts(),
    getMarketStats(),
    getUsageStats(),
    getAuthUser(),
    getAppSetting("last_cron_error"),
  ]);
  const campaignKey = campaignKeyResult.success ? campaignKeyResult.data : "";
  const scripts = scriptsResult.success ? scriptsResult.data : null;
  const usageStats = usageStatsResult.success ? usageStatsResult.data : null;
  const isAdmin = user?.role === "admin";

  // Set by cron-health when a scheduled job fails; cleared on its next success.
  let cronError: { route: string; message: string; at: string } | null = null;
  if (cronErrorResult.success && cronErrorResult.data) {
    try {
      cronError = JSON.parse(cronErrorResult.data);
    } catch {
      cronError = null;
    }
  }

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

      {cronError && (
        <div className="rounded-lg border border-red-400 bg-red-50 px-4 py-3 dark:border-red-700 dark:bg-red-950/40">
          <p className="text-sm font-semibold text-red-800 dark:text-red-300">
            Scheduled job failing: {cronError.route}
          </p>
          <p className="mt-0.5 text-xs text-red-700 dark:text-red-400">
            {cronError.message} —{" "}
            {new Date(cronError.at).toLocaleString("en-US", {
              timeZone: "America/Los_Angeles",
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
            . This banner clears automatically once the job succeeds again.
          </p>
        </div>
      )}

      <CollapsibleCard title="Usage Monitor" defaultOpen>
        <UsageMonitor initialStats={usageStats} isAdmin={isAdmin} />
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

        <CollapsibleCard title="JV Activity Log">
          <JvActivityLog />
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
