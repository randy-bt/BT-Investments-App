"use client";

import { useState, useEffect, useRef } from "react";
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
  seattle: "Seattle",
  local: "Local",
  national: "National",
  macro: "Macro Econ",
  stocks: "Stocks",
  ai: "AI",
};

/** Split summary into lede (before ---) and body (after ---) */
function splitLedeAndBody(text: string): { lede: string; body: string } {
  const divider = text.indexOf("\n---\n");
  if (divider !== -1) {
    return {
      lede: text.slice(0, divider).trim(),
      body: text.slice(divider + 5).trim(),
    };
  }
  // Fallback for older summaries without the --- divider: use first sentence
  const firstPeriod = text.indexOf(". ");
  if (firstPeriod !== -1 && firstPeriod < 200) {
    return {
      lede: text.slice(0, firstPeriod + 1).trim(),
      body: text.slice(firstPeriod + 2).trim(),
    };
  }
  return { lede: "", body: text };
}

/** Render markdown bold/italic into JSX spans */
function renderFormattedText(text: string) {
  return text.split("\n\n").map((paragraph, pIdx) => {
    const parts: React.ReactNode[] = [];
    const regex = /(\*\*(.+?)\*\*|\*(.+?)\*)/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(paragraph)) !== null) {
      if (match.index > lastIndex) {
        parts.push(paragraph.slice(lastIndex, match.index));
      }
      if (match[2]) {
        parts.push(
          <strong key={`${pIdx}-${match.index}`} className="font-semibold">
            {match[2]}
          </strong>
        );
      } else if (match[3]) {
        parts.push(
          <em key={`${pIdx}-${match.index}`}>{match[3]}</em>
        );
      }
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < paragraph.length) {
      parts.push(paragraph.slice(lastIndex));
    }

    return (
      <p key={pIdx} className="mb-4 last:mb-0">
        {parts}
      </p>
    );
  });
}

/** Strip markdown for TTS */
function stripMarkdown(text: string): string {
  return text.replace(/\*\*(.+?)\*\*/g, "$1").replace(/\*(.+?)\*/g, "$1");
}

export function ArticleDetailClient({ article }: { article: NewsArticle }) {
  const [summary, setSummary] = useState<string | null>(article.summary);
  const [loading, setLoading] = useState(!article.summary);
  const [elapsed, setElapsed] = useState(0);
  const [fallbackReason, setFallbackReason] = useState<string | null>(null);
  const [excerpt, setExcerpt] = useState<string | null>(null);

  // Read aloud state
  const [audioState, setAudioState] = useState<"idle" | "loading" | "playing" | "paused">("idle");
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!loading) return;
    const interval = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(interval);
  }, [loading]);

  useEffect(() => {
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
  }, [article.id, article.summary]);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        URL.revokeObjectURL(audioRef.current.src);
      }
    };
  }, []);

  async function handleReadAloud() {
    if (audioState === "playing") {
      audioRef.current?.pause();
      setAudioState("paused");
      return;
    }

    if (audioState === "paused" && audioRef.current) {
      audioRef.current.play();
      setAudioState("playing");
      return;
    }

    if (!summary) return;
    setAudioState("loading");

    try {
      const plainText = stripMarkdown(summary);
      const res = await fetch("/api/news/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: plainText }),
      });

      if (!res.ok) {
        setAudioState("idle");
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;

      audio.onended = () => {
        setAudioState("idle");
        URL.revokeObjectURL(url);
      };

      audio.play();
      setAudioState("playing");
    } catch {
      setAudioState("idle");
    }
  }

  const { lede, body } = summary ? splitLedeAndBody(summary) : { lede: "", body: "" };

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

      {/* Read Aloud button */}
      {summary && (
        <button
          type="button"
          onClick={handleReadAloud}
          disabled={audioState === "loading"}
          className="flex items-center gap-2 self-start rounded-md border border-neutral-300 bg-neutral-50 px-3 py-1.5 text-xs text-neutral-600 hover:bg-neutral-100 disabled:opacity-50 transition-colors"
        >
          {audioState === "loading" ? (
            <>
              <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Generating audio...
            </>
          ) : audioState === "playing" ? (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="4" width="4" height="16" rx="1" />
                <rect x="14" y="4" width="4" height="16" rx="1" />
              </svg>
              Pause
            </>
          ) : (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
              </svg>
              {audioState === "paused" ? "Resume" : "Read Aloud"}
            </>
          )}
        </button>
      )}

      {/* Summary */}
      <div className="rounded-lg border border-dashed border-neutral-300 bg-white p-6 shadow-sm">
        {loading ? (
          <div className="space-y-3">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-200">
              <div
                className="h-full rounded-full bg-blue-500 transition-all duration-1000 ease-out"
                style={{ width: `${Math.min(elapsed * 8, 90)}%` }}
              />
            </div>
            <div className="flex items-center gap-2">
              <svg className="h-4 w-4 animate-spin text-blue-500" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span className="text-sm text-neutral-400">
                {elapsed < 3 ? "Extracting article..." : elapsed < 8 ? "Generating summary..." : "Almost done..."}
              </span>
              <span className="ml-auto text-xs text-neutral-400">{elapsed}s</span>
            </div>
          </div>
        ) : summary ? (
          <div>
            {/* Lede — large serif text */}
            {lede && (
              <p
                className="text-lg leading-relaxed text-neutral-800 mb-5 pb-5 border-b border-neutral-200"
                style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
              >
                {lede}
              </p>
            )}
            {/* Body */}
            <div className="text-[0.9rem] leading-relaxed text-neutral-700 font-editable">
              {renderFormattedText(body)}
            </div>
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
      <p className="text-sm text-neutral-400">
        OG Article:{" "}
        <a
          href={article.source_url}
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-neutral-600 transition-colors"
        >
          {article.source_name}
        </a>
      </p>
    </main>
  );
}
