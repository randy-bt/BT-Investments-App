"use client";

import { useState, useTransition } from "react";
import { searchArticles } from "@/actions/news";
import type { NewsArticle } from "@/lib/types";

const CATEGORY_PILLS: Record<string, { label: string; color: string }> = {
  local: { label: "Local", color: "bg-blue-50 text-blue-600 border-blue-200" },
  national: {
    label: "National",
    color: "bg-green-50 text-green-600 border-green-200",
  },
  macro: {
    label: "Macro Econ",
    color: "bg-amber-50 text-amber-600 border-amber-200",
  },
  stocks: {
    label: "Stocks",
    color: "bg-purple-50 text-purple-600 border-purple-200",
  },
  ai: { label: "AI", color: "bg-rose-50 text-rose-600 border-rose-200" },
};

function groupByDate(articles: NewsArticle[]): Map<string, NewsArticle[]> {
  const groups = new Map<string, NewsArticle[]>();
  for (const article of articles) {
    const dateKey = new Date(article.fetched_at).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
    const list = groups.get(dateKey) || [];
    list.push(article);
    groups.set(dateKey, list);
  }
  return groups;
}

export function ArchiveClient({
  initialArticles,
}: {
  initialArticles: NewsArticle[];
}) {
  const [articles, setArticles] = useState(initialArticles);
  const [query, setQuery] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSearch(value: string) {
    setQuery(value);

    if (!value.trim()) {
      setArticles(initialArticles);
      return;
    }

    startTransition(async () => {
      const result = await searchArticles(value.trim());
      if (result.success) {
        setArticles(result.data);
      }
    });
  }

  const grouped = groupByDate(articles);

  return (
    <div className="space-y-6">
      <input
        type="text"
        placeholder="Search headlines and sources..."
        value={query}
        onChange={(e) => handleSearch(e.target.value)}
        className="w-full rounded border border-neutral-300 bg-neutral-100 px-3 py-2 text-sm font-editable"
      />

      {isPending && (
        <p className="text-xs text-neutral-400 animate-pulse">Searching...</p>
      )}

      {articles.length === 0 ? (
        <p className="text-sm text-neutral-400 py-4">No articles found.</p>
      ) : (
        Array.from(grouped.entries()).map(([dateLabel, dateArticles]) => (
          <div key={dateLabel}>
            <h3 className="text-[0.65rem] font-medium text-neutral-400 uppercase tracking-wider mb-2">
              {dateLabel}
            </h3>
            <div className="space-y-1">
              {dateArticles.map((article) => {
                const pill = CATEGORY_PILLS[article.category] || {
                  label: article.category,
                  color:
                    "bg-neutral-50 text-neutral-500 border-neutral-200",
                };
                return (
                  <a
                    key={article.id}
                    href={`/app/housing-market-news/article/${article.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between py-1.5 group"
                  >
                    <span className="text-sm font-editable group-hover:underline truncate mr-3">
                      {article.title}
                    </span>
                    <span
                      className={`shrink-0 rounded-full border px-2 py-0.5 text-[0.6rem] ${pill.color}`}
                    >
                      {pill.label}
                    </span>
                  </a>
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
