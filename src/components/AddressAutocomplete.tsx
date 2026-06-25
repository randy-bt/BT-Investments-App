"use client";

import { useState, useRef, useEffect, useCallback } from "react";

type Suggestion = {
  place_id: string;
  description: string;
};

interface AddressAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

export function AddressAutocomplete({
  value,
  onChange,
  className = "",
}: AddressAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [configError, setConfigError] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const fetchSuggestions = useCallback(async (input: string) => {
    if (!input.trim() || !API_KEY) {
      setSuggestions([]);
      return;
    }
    try {
      const res = await fetch(
        `/api/places/autocomplete?input=${encodeURIComponent(input)}`
      );
      if (!res.ok) return;
      const data = await res.json();
      // `error: "config"` means the Google Maps/Places API rejected the
      // request (billing disabled / API not enabled), not that there were no
      // matches. Surface a note so the cause is obvious next time.
      setConfigError(data.error === "config");
      setSuggestions(data.predictions || []);
    } catch {
      // Silently fail — user can still type freely
    }
  }, []);

  function handleInputChange(val: string) {
    onChange(val);
    setActiveIndex(-1);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (val.length >= 3) {
        fetchSuggestions(val);
        setShowDropdown(true);
      } else {
        setSuggestions([]);
        setShowDropdown(false);
      }
    }, 300);
  }

  function selectSuggestion(description: string) {
    onChange(description);
    setSuggestions([]);
    setShowDropdown(false);
    setActiveIndex(-1);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!showDropdown || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((prev) =>
        prev < suggestions.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) =>
        prev > 0 ? prev - 1 : suggestions.length - 1
      );
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault();
      selectSuggestion(suggestions[activeIndex].description);
    } else if (e.key === "Escape") {
      setShowDropdown(false);
    }
  }

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={wrapperRef} className="relative flex-1">
      <input
        value={value}
        onChange={(e) => handleInputChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => {
          if (suggestions.length > 0) setShowDropdown(true);
        }}
        className={className}
      />
      {configError && (
        <p className="absolute z-50 left-0 right-0 mt-1 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-300">
          Address autocomplete is unavailable — billing is disabled on the
          Google Cloud project for the Maps/Places API. Re-enable billing in
          Google Cloud Console to restore it. You can still type the address
          manually.
        </p>
      )}
      {showDropdown && suggestions.length > 0 && (
        <ul className="absolute z-50 left-0 right-0 mt-1 max-h-48 overflow-y-auto rounded border border-neutral-200 bg-white shadow-lg">
          {suggestions.map((s, i) => (
            <li
              key={s.place_id}
              onMouseDown={() => selectSuggestion(s.description)}
              className={`cursor-pointer px-3 py-1.5 text-sm ${
                i === activeIndex
                  ? "bg-neutral-100 text-neutral-900"
                  : "text-neutral-700 hover:bg-neutral-50"
              }`}
            >
              {s.description}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
