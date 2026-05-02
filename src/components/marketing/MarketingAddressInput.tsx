"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Suggestion = {
  place_id: string;
  description: string;
};

type AddressComponents = {
  street: string;
  city: string;
  state: string;
  zip: string;
};

interface Props {
  street: string;
  onStreetChange: (s: string) => void;
  /**
   * Called when the user selects a suggestion from the dropdown — passes
   * the parsed address components so the form can populate city/state/zip.
   * Not called when the user just types freely.
   */
  onSuggestionSelected: (components: AddressComponents) => void;
  placeholder?: string;
  required?: boolean;
  className?: string;
}

/**
 * MarketingAddressInput — typed address input with Google Places
 * autocomplete suggestions. Free typing is always allowed; selecting
 * a suggestion auto-populates city / state / zip via the parent.
 *
 * Marketing-styled: cream-colored, marketing fonts, olive accents on
 * focus / hover. Backed by the same /api/places/autocomplete +
 * /api/places/details endpoints as the internal app.
 */
export function MarketingAddressInput({
  street,
  onStreetChange,
  onSuggestionSelected,
  placeholder,
  required,
  className = "",
}: Props) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const fetchSuggestions = useCallback(async (input: string) => {
    if (!input.trim()) {
      setSuggestions([]);
      return;
    }
    try {
      const res = await fetch(
        `/api/places/autocomplete?input=${encodeURIComponent(input)}`
      );
      if (!res.ok) return;
      const data = await res.json();
      setSuggestions(data.predictions ?? []);
    } catch {
      // Silently fail — user can keep typing freely
    }
  }, []);

  function handleInputChange(val: string) {
    onStreetChange(val);
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

  async function selectSuggestion(s: Suggestion) {
    setShowDropdown(false);
    setSuggestions([]);
    setActiveIndex(-1);

    // Fetch structured components for the selected place
    try {
      const res = await fetch(
        `/api/places/details?place_id=${encodeURIComponent(s.place_id)}`
      );
      if (!res.ok) {
        // Fall back to using just the description as the street value
        onStreetChange(s.description);
        return;
      }
      const data = (await res.json()) as AddressComponents;
      // If we got a parsed street back, use it; otherwise fall back to
      // the description string so the user has *something* in the field.
      const finalStreet = data.street || s.description;
      onStreetChange(finalStreet);
      onSuggestionSelected({
        street: finalStreet,
        city: data.city,
        state: data.state,
        zip: data.zip,
      });
    } catch {
      onStreetChange(s.description);
    }
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
      selectSuggestion(suggestions[activeIndex]);
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
    <div ref={wrapperRef} className="relative">
      <input
        value={street}
        onChange={(e) => handleInputChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => {
          if (suggestions.length > 0) setShowDropdown(true);
        }}
        placeholder={placeholder}
        required={required}
        className={className}
        // Match the styling used by Field/SelectField in MarketingFormPrimitives
        // so the address input doesn't render as an invisible box on the
        // cream-dim card background.
        style={{
          background: "var(--mkt-cream)",
          color: "var(--mkt-text-on-light)",
          border: "1px solid rgba(0,0,0,0.1)",
        }}
        autoComplete="street-address"
      />
      {showDropdown && suggestions.length > 0 && (
        <ul
          className="absolute z-50 left-0 right-0 mt-1 max-h-64 overflow-y-auto rounded-lg shadow-lg"
          style={{
            background: "var(--mkt-cream)",
            border: "1px solid rgba(0,0,0,0.1)",
          }}
        >
          {suggestions.map((s, i) => (
            <li
              key={s.place_id}
              onMouseDown={() => selectSuggestion(s)}
              className="cursor-pointer px-4 py-2.5 text-sm font-mkt-sans transition-colors"
              style={{
                background:
                  i === activeIndex ? "rgba(118, 121, 76, 0.12)" : "transparent",
                color: "var(--mkt-text-on-light)",
              }}
            >
              {s.description}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
