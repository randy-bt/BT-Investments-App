import Link from "next/link";
import { getSavedArticles } from "@/actions/saved-articles";
import { SavedArticlesList } from "./client";

export default async function SavedArticlesPage() {
  const result = await getSavedArticles();
  const articles = result.success ? result.data : [];

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-10">
      <Link
        href="/app/housing-market-news"
        className="text-sm text-neutral-400 hover:text-neutral-600 transition-colors"
      >
        &larr; Back to News
      </Link>

      <h1 className="text-xl font-semibold tracking-tight">Saved Articles</h1>

      {articles.length === 0 ? (
        <p className="text-sm text-neutral-400 text-center py-8">
          No saved articles yet. Bookmark articles to see them here.
        </p>
      ) : (
        <SavedArticlesList initialArticles={articles} />
      )}
    </main>
  );
}
