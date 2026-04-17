import Link from "next/link";
import { getTodayArticles } from "@/actions/news";
import { getMarketStats } from "@/actions/market-stats";
import { WeatherHeader, MarketStatsBar, NewsSections } from "./client";
import { CycleButton } from "./cycle-button";

export default async function HousingMarketNewsPage() {
  const [result, statsResult] = await Promise.all([
    getTodayArticles(),
    getMarketStats(),
  ]);
  const articles = result.success ? result.data : [];
  const marketStats = statsResult.success ? statsResult.data : [];

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-4 px-6 py-10">
      <div className="flex items-center justify-between">
        <Link
          href="/app"
          className="text-sm text-neutral-400 hover:text-neutral-600 transition-colors"
        >
          &larr; Back to Dashboard
        </Link>
        <div className="flex items-center gap-2">
          <Link
            href="/app/housing-market-news/saved"
            className="flex items-center gap-1.5 rounded-md border border-neutral-300 bg-neutral-50 px-3 py-1.5 text-xs text-neutral-600 hover:bg-neutral-100 transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
            </svg>
            Saved Articles
          </Link>
          <CycleButton />
        </div>
      </div>

      <WeatherHeader />
      <MarketStatsBar stats={marketStats} />

      {articles.length === 0 ? (
        <p className="text-sm text-neutral-400 text-center py-8">
          No articles yet. News refreshes daily at 8am Pacific.
        </p>
      ) : (
        <NewsSections articles={articles} />
      )}

      <div className="pt-4 border-t border-dashed border-neutral-200 mt-4">
        <Link
          href="/app/housing-market-news/archive"
          className="text-xs text-neutral-400 hover:text-neutral-600 transition-colors"
        >
          View Archive
        </Link>
      </div>
    </main>
  );
}
