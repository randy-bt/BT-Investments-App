import Link from "next/link";
import { getTodayArticles } from "@/actions/news";
import { WeatherHeader, NewsSections } from "./client";

export default async function HousingMarketNewsPage() {
  const result = await getTodayArticles();
  const articles = result.success ? result.data : [];

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-4 px-6 py-10">
      <WeatherHeader />

      {articles.length === 0 ? (
        <p className="text-sm text-neutral-400 text-center py-8">
          No articles yet. News refreshes at 8am, 12pm, and 4pm Pacific.
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
