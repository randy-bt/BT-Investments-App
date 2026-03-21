"use client";

import { useState, useEffect } from "react";

type Weather = { tempF: number; code: number };

// wttr.in weather codes → simple icons
// https://www.worldweatheronline.com/developer/api/docs/weather-icons.aspx
function WeatherIcon({ code }: { code: number }) {
  // Sunny / clear
  if (code === 113) {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="5" />
        <line x1="12" y1="1" x2="12" y2="3" />
        <line x1="12" y1="21" x2="12" y2="23" />
        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
        <line x1="1" y1="12" x2="3" y2="12" />
        <line x1="21" y1="12" x2="23" y2="12" />
        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
        <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
      </svg>
    );
  }
  // Partly cloudy
  if (code === 116) {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2v2" />
        <path d="M4.93 4.93l1.41 1.41" />
        <path d="M20 12h2" />
        <path d="M19.07 4.93l-1.41 1.41" />
        <path d="M15.947 12.65a4 4 0 00-5.925-4.128" />
        <path d="M13 22H7a5 5 0 110-10h.09A8 8 0 0117 13a4.5 4.5 0 01-1 8.9" />
      </svg>
    );
  }
  // Rain / drizzle / sleet
  if ([176, 263, 266, 281, 284, 293, 296, 299, 302, 305, 308, 311, 314, 317, 320, 353, 356, 359, 362, 365].includes(code)) {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 14.899A7 7 0 1115.71 8h1.79a4.5 4.5 0 012.5 8.242" />
        <path d="M16 14v6" />
        <path d="M8 14v6" />
        <path d="M12 16v6" />
      </svg>
    );
  }
  // Snow / blizzard / ice
  if ([179, 182, 185, 227, 230, 323, 326, 329, 332, 335, 338, 350, 368, 371, 374, 377, 392, 395].includes(code)) {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 14.899A7 7 0 1115.71 8h1.79a4.5 4.5 0 012.5 8.242" />
        <path d="M8 15h.01" />
        <path d="M8 19h.01" />
        <path d="M12 17h.01" />
        <path d="M12 21h.01" />
        <path d="M16 15h.01" />
        <path d="M16 19h.01" />
      </svg>
    );
  }
  // Thunderstorm
  if ([200, 386, 389].includes(code)) {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 14.899A7 7 0 1115.71 8h1.79a4.5 4.5 0 012.5 8.242" />
        <path d="M13 12l-3 5h4l-3 5" />
      </svg>
    );
  }
  // Fog / mist
  if ([143, 248, 260].includes(code)) {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 14.899A7 7 0 1115.71 8h1.79a4.5 4.5 0 012.5 8.242" />
        <path d="M16 17H7" />
        <path d="M17 21H9" />
      </svg>
    );
  }
  // Cloudy / overcast (default cloud)
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.5 19H9a7 7 0 110-14h.09A8 8 0 0119 9.5a4.5 4.5 0 01-1.5 9.5z" />
    </svg>
  );
}

export function LiveClock() {
  const [now, setNow] = useState<Date | null>(null);
  const [weather, setWeather] = useState<Weather | null>(null);

  useEffect(() => {
    setNow(new Date());
    const interval = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    fetch("https://wttr.in/Seattle?format=j1")
      .then((r) => r.json())
      .then((data) => {
        const current = data?.current_condition?.[0];
        if (current) {
          setWeather({
            tempF: Number(current.temp_F),
            code: Number(current.weatherCode),
          });
        }
      })
      .catch(() => {});
  }, []);

  if (!now) return null;

  return (
    <p className="flex items-center gap-1.5 text-sm text-neutral-600">
      <span>
        {now.toLocaleDateString("en-US", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        })}
      </span>
      {weather && (
        <>
          <span>&middot;</span>
          <span className="inline-flex items-center gap-1">
            <WeatherIcon code={weather.code} />
            {weather.tempF}&deg;F
          </span>
        </>
      )}
    </p>
  );
}
