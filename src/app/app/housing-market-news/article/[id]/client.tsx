"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import type { NewsArticle } from "@/lib/types";

function formatDate(dateStr: string | null) {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

const CATEGORY_PILLS: Record<string, string> = {
  local: "Local",
  national: "National",
  macro: "Macro Econ",
  stocks: "Stocks",
  ai: "AI",
};

// Categories that show original article text instead of AI summary
const ORIGINAL_TEXT_CATEGORIES = new Set(["national"]);

export function ArticleDetailClient({ article }: { article: NewsArticle }) {
  const useOriginalText = ORIGINAL_TEXT_CATEGORIES.has(article.category);

  const [summary, setSummary] = useState<string | null>(article.summary);
  const [originalText, setOriginalText] = useState<string | null>(null);
  const [loading, setLoading] = useState(
    useOriginalText ? true : !article.summary
  );
  const [fallbackReason, setFallbackReason] = useState<string | null>(null);
  const [excerpt, setExcerpt] = useState<string | null>(null);

  useEffect(() => {
    if (useOriginalText) {
      // Fetch original article text
      async function fetchOriginal() {
        try {
          const res = await fetch(`/api/news/rewrite/${article.id}`, {
            method: "POST",
            headers: { "X-Original-Text": "true" },
          });
          const data = await res.json();

          if (data.originalText) {
            setOriginalText(data.originalText);
          } else if (data.fallback) {
            setFallbackReason(data.fallbackReason);
            setExcerpt(data.excerpt);
          } else {
            setFallbackReason("Could not load article text.");
          }
        } catch {
          setFallbackReason("Failed to load article. Please try again later.");
        } finally {
          setLoading(false);
        }
      }
      fetchOriginal();
      return;
    }

    // Default: fetch AI summary
    if (article.summary) return;

    async function fetchSummary() {
      try {
        const res = await fetch(`/api/news/rewrite/${article.id}`, {
          method: "POST",
        });
        const data = await res.json();

        if (data.success && data.summary) {
          setSummary(data.summary);
        } else if (data.fallback) {
          setFallbackReason(data.fallbackReason);
          setExcerpt(data.excerpt);
        } else {
          setFallbackReason("Summary temporarily unavailable.");
        }
      } catch {
        setFallbackReason(
          "Failed to generate summary. Please try again later."
        );
      } finally {
        setLoading(false);
      }
    }

    fetchSummary();
  }, [article.id, article.summary, useOriginalText]);

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-6 py-10">
      {/* Back button */}
      <Link
        href="/app/housing-market-news"
        className="text-sm text-neutral-400 hover:text-neutral-600 transition-colors"
      >
        &larr; Back to News
      </Link>

      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <span className="rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-0.5 text-[0.65rem] text-neutral-500">
            {CATEGORY_PILLS[article.category] || article.category}
          </span>
          <span className="text-xs text-neutral-400">
            {article.source_name}
          </span>
        </div>
        <h1 className="text-xl font-semibold tracking-tight leading-snug">
          {article.title}
        </h1>
        <p className="text-sm text-neutral-500 mt-2">
          {formatDate(article.published_at || article.fetched_at)}
        </p>
      </div>

      {/* Content */}
      <div className="rounded-lg border border-dashed border-neutral-300 bg-white p-6 shadow-sm">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-neutral-400 animate-pulse">
            <span className="inline-block h-4 w-4 rounded-full border-2 border-neutral-300 border-t-neutral-500 animate-spin" />
            {useOriginalText ? "Loading article..." : "Generating summary..."}
          </div>
        ) : originalText ? (
          <div className="text-sm leading-relaxed text-neutral-700 font-editable whitespace-pre-line">
            {originalText}
          </div>
        ) : summary ? (
          <div className="text-sm leading-relaxed text-neutral-700 font-editable whitespace-pre-line">
            {summary}
          </div>
        ) : (
          <div className="space-y-3">
            {fallbackReason && (
              <p className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded px-3 py-2">
                {fallbackReason}
              </p>
            )}
            {excerpt && (
              <div className="text-sm text-neutral-600 font-editable">
                <p className="text-[0.65rem] text-neutral-400 uppercase tracking-wider mb-1">
                  Original Excerpt
                </p>
                {excerpt}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Link to original */}
      <a
        href={article.source_url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-sm text-neutral-400 hover:text-neutral-600 transition-colors"
      >
        Read original article &rarr;
      </a>
    </main>
  );
}
