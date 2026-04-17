"use client";

import { useState, useEffect } from "react";
import type { NewsArticle } from "@/lib/types";
import type { MarketStat } from "@/actions/market-stats";

// Weather component
export function WeatherHeader() {
  const [weather, setWeather] = useState<{
    temp: number;
    condition: string;
    icon: string;
  } | null>(null);

  const now = new Date();
  const dateStr = now.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  useEffect(() => {
    async function fetchWeather() {
      try {
        const res = await fetch(
          "https://api.open-meteo.com/v1/forecast?latitude=47.6062&longitude=-122.3321&current=temperature_2m,weather_code&temperature_unit=fahrenheit&timezone=America/Los_Angeles"
        );
        const data = await res.json();
        const code = data.current.weather_code as number;
        const temp = Math.round(data.current.temperature_2m as number);

        let condition = "Clear";
        let icon = "sun";
        if (code >= 1 && code <= 3) { condition = "Partly Cloudy"; icon = "cloud-sun"; }
        if (code >= 45 && code <= 48) { condition = "Foggy"; icon = "cloud"; }
        if (code >= 51 && code <= 67) { condition = "Rain"; icon = "cloud-rain"; }
        if (code >= 71 && code <= 77) { condition = "Snow"; icon = "cloud-snow"; }
        if (code >= 80 && code <= 82) { condition = "Showers"; icon = "cloud-rain"; }
        if (code >= 95) { condition = "Thunderstorm"; icon = "cloud-lightning"; }

        setWeather({ temp, condition, icon });
      } catch {
        // Weather is non-critical, fail silently
      }
    }
    fetchWeather();
  }, []);

  const WEATHER_ICONS: Record<string, string> = {
    "sun": "\u2600\uFE0F",
    "cloud-sun": "\u26C5",
    "cloud": "\u2601\uFE0F",
    "cloud-rain": "\uD83C\uDF27\uFE0F",
    "cloud-snow": "\uD83C\uDF28\uFE0F",
    "cloud-lightning": "\u26C8\uFE0F",
  };

  return (
    <div className="text-center pt-6 pb-0">
      <p className="text-[2.7rem] font-semibold tracking-tight leading-tight">{dateStr}</p>
      {weather && (
        <p className="text-[0.94rem] text-neutral-600 mt-2">
          Seattle — {WEATHER_ICONS[weather.icon] || ""} {weather.temp}°F, {weather.condition}
        </p>
      )}
    </div>
  );
}

function formatStatValue(key: string, value: number): string {
  if (key.startsWith("median_")) {
    if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
    return `$${(value / 1000).toFixed(0)}K`;
  }
  // Rates: show percentage
  return `${value.toFixed(2)}%`;
}

const DAILY_STATS = [
  { key: "mortgage_30yr", label: "30-Yr Mortgage" },
  { key: "treasury_10yr", label: "10-Yr Treasury" },
];

const MONTHLY_STATS = [
  { key: "median_seattle", label: "Seattle" },
  { key: "median_tacoma", label: "Tacoma" },
  { key: "median_bellevue", label: "Bellevue" },
];

export function MarketStatsBar({ stats }: { stats: MarketStat[] }) {
  const statsMap = new Map(stats.map((s) => [s.stat_key, s]));

  const dailyItems = DAILY_STATS.map((s) => statsMap.get(s.key)).filter(
    (s): s is MarketStat => !!s && s.value > 0
  );
  const monthlyItems = MONTHLY_STATS.map((s) => statsMap.get(s.key)).filter(
    (s): s is MarketStat => !!s && s.value > 0
  );

  if (dailyItems.length === 0) return null;

  return (
    <div className="space-y-3 -mt-2 pb-4">
      {/* Daily stats */}
      <div className="flex items-center justify-center gap-6 flex-wrap">
        {dailyItems.map((stat) => {
          const config = DAILY_STATS.find((s) => s.key === stat.stat_key);
          return (
            <div key={stat.stat_key} className="text-center">
              <p className="text-xl md:text-lg font-semibold tracking-tight font-editable">
                {formatStatValue(stat.stat_key, stat.value)}
              </p>
              <p className="text-[0.6rem] text-neutral-400 uppercase tracking-wider">
                {config?.label}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const SECTION_CONFIG: { key: string; label: string }[] = [
  { key: "local", label: "Local RE News" },
  { key: "national", label: "National RE News" },
  { key: "macro", label: "Macro Econ" },
  { key: "stocks", label: "Real Estate Stocks" },
  { key: "ai", label: "AI News" },
  { key: "seattle", label: "Seattle News" },
];

function formatHeadlineDate(dateStr: string | null) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}.${d.getDate()}`;
}

export function NewsSections({ articles }: { articles: NewsArticle[] }) {
  const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);

  const grouped = new Map<string, NewsArticle[]>();
  for (const section of SECTION_CONFIG) {
    let sectionArticles = articles.filter((a) => a.category === section.key);
    // AI section: only show articles from the last 2 days
    if (section.key === "ai") {
      sectionArticles = sectionArticles.filter((a) => {
        const date = new Date(a.published_at || a.fetched_at);
        return date >= twoDaysAgo;
      });
    }
    grouped.set(section.key, sectionArticles);
  }

  return (
    <div className="space-y-8">
      {SECTION_CONFIG.map((section) => {
        const sectionArticles = grouped.get(section.key) || [];
        if (sectionArticles.length === 0) return null;

        return (
          <div key={section.key}>
            <h2 className="text-xs md:text-[0.65rem] font-medium text-neutral-400 uppercase tracking-wider mb-3">
              {section.label}
            </h2>
            <div className="space-y-0.5">
              {sectionArticles.map((article) => (
                <a
                  key={article.id}
                  href={`/app/housing-market-news/article/${article.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block py-2.5 md:py-1.5 text-lg md:text-sm hover:text-neutral-600 transition-colors group"
                >
                  <span className="text-neutral-400 text-sm md:text-xs mr-2 font-editable">
                    {formatHeadlineDate(article.published_at || article.fetched_at)}
                  </span>
                  <span className="font-editable group-hover:underline">
                    {article.title}
                  </span>
                </a>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
