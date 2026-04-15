"use client";

import { useState, useTransition } from "react";
import type { NewsArticle } from "@/lib/types";
import { toggleSaveArticle } from "@/actions/saved-articles";

const CATEGORY_PILLS: Record<string, { label: string; color: string }> = {
  seattle: { label: "Seattle", color: "bg-teal-50 text-teal-600 border-teal-200" },
  local: { label: "Local", color: "bg-blue-50 text-blue-600 border-blue-200" },
  national: { label: "National", color: "bg-green-50 text-green-600 border-green-200" },
  macro: { label: "Macro Econ", color: "bg-amber-50 text-amber-600 border-amber-200" },
  stocks: { label: "Stocks", color: "bg-purple-50 text-purple-600 border-purple-200" },
  ai: { label: "AI", color: "bg-rose-50 text-rose-600 border-rose-200" },
};

export function SavedArticlesList({ initialArticles }: { initialArticles: NewsArticle[] }) {
  const [articles, setArticles] = useState(initialArticles);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleRemove(articleId: string) {
    setRemovingId(articleId);
    startTransition(async () => {
      const result = await toggleSaveArticle(articleId);
      if (result.success && !result.data.saved) {
        setArticles((prev) => prev.filter((a) => a.id !== articleId));
      }
      setRemovingId(null);
    });
  }

  return (
    <div className="space-y-1">
      {articles.map((article) => {
        const pill = CATEGORY_PILLS[article.category] || {
          label: article.category,
          color: "bg-neutral-50 text-neutral-500 border-neutral-200",
        };
        return (
          <div
            key={article.id}
            className="flex items-center gap-2 py-1.5 group"
          >
            <button
              type="button"
              onClick={() => handleRemove(article.id)}
              disabled={isPending && removingId === article.id}
              className="shrink-0 text-amber-400 hover:text-neutral-300 transition-colors disabled:opacity-50"
              title="Remove from saved"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
              </svg>
            </button>
            <a
              href={`/app/housing-market-news/article/${article.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-editable group-hover:underline truncate flex-1"
            >
              {article.title}
            </a>
            <span
              className={`shrink-0 rounded-full border px-2 py-0.5 text-[0.6rem] ${pill.color}`}
            >
              {pill.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
