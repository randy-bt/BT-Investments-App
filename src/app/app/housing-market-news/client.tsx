"use client";

import { useState, useEffect } from "react";
import type { NewsArticle } from "@/lib/types";

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
  const timeStr = now.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
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
    <div className="text-center py-6">
      <p className="text-2xl font-semibold tracking-tight">{dateStr}</p>
      <p className="text-sm text-neutral-500 mt-1">{timeStr}</p>
      {weather && (
        <p className="text-sm text-neutral-500 mt-1">
          Seattle — {WEATHER_ICONS[weather.icon] || ""} {weather.temp}°F, {weather.condition}
        </p>
      )}
    </div>
  );
}

const SECTION_CONFIG: { key: string; label: string }[] = [
  { key: "local", label: "Local RE News" },
  { key: "national", label: "National RE News" },
  { key: "macro", label: "Macro Econ" },
  { key: "stocks", label: "Real Estate Stocks" },
  { key: "ai", label: "AI News" },
];

function formatHeadlineDate(dateStr: string | null) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}.${d.getDate()}`;
}

export function NewsSections({ articles }: { articles: NewsArticle[] }) {
  const grouped = new Map<string, NewsArticle[]>();
  for (const section of SECTION_CONFIG) {
    grouped.set(
      section.key,
      articles.filter((a) => a.category === section.key)
    );
  }

  return (
    <div className="space-y-8">
      {SECTION_CONFIG.map((section) => {
        const sectionArticles = grouped.get(section.key) || [];
        if (sectionArticles.length === 0) return null;

        return (
          <div key={section.key}>
            <h2 className="text-[0.65rem] font-medium text-neutral-400 uppercase tracking-wider mb-3">
              {section.label}
            </h2>
            <div className="space-y-1">
              {sectionArticles.map((article) => (
                <a
                  key={article.id}
                  href={`/app/housing-market-news/article/${article.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block py-1.5 text-sm hover:text-neutral-600 transition-colors group"
                >
                  <span className="text-neutral-400 text-xs mr-2 font-editable">
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
