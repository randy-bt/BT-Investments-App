"use client";

import { useEffect, useRef, useState } from "react";

export type ComboboxOption<T> = {
  value: string;
  label: string;
  sublabel?: string | null;
  raw: T;
};

type Props<T> = {
  options: ComboboxOption<T>[];
  value: string;
  onChange: (value: string, raw: T | null) => void;
  placeholder?: string;
  emptyText?: string;
  className?: string;
};

export function Combobox<T>({
  options,
  value,
  onChange,
  placeholder = "Type to search…",
  emptyText = "No matches",
  className = "",
}: Props<T>) {
  const selected = options.find((o) => o.value === value) ?? null;
  const [query, setQuery] = useState(selected?.label ?? "");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Keep input text in sync when external value changes
  useEffect(() => {
    setQuery(selected?.label ?? "");
  }, [selected?.label]);

  // Close on outside click
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const filtered =
    query.trim() === "" || query === selected?.label
      ? options
      : options.filter((o) => {
          const q = query.toLowerCase();
          return (
            o.label.toLowerCase().includes(q) ||
            (o.sublabel?.toLowerCase().includes(q) ?? false)
          );
        });

  function commit(opt: ComboboxOption<T> | null) {
    if (opt) {
      onChange(opt.value, opt.raw);
      setQuery(opt.label);
    } else {
      onChange("", null);
      setQuery("");
    }
    setOpen(false);
  }

  function onKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setHighlight((h) => Math.min(h + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filtered[highlight]) commit(filtered[highlight]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <input
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setHighlight(0);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKey}
        placeholder={placeholder}
        className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm"
      />
      {value && (
        <button
          type="button"
          onClick={() => commit(null)}
          aria-label="Clear"
          className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 text-sm"
        >
          ×
        </button>
      )}
      {open && (
        <ul className="absolute z-20 mt-1 w-full max-h-60 overflow-y-auto rounded-md border border-neutral-200 bg-white shadow-lg text-sm">
          {filtered.length === 0 ? (
            <li className="px-3 py-2 text-neutral-400">{emptyText}</li>
          ) : (
            filtered.map((opt, idx) => (
              <li
                key={opt.value}
                onMouseDown={(e) => {
                  e.preventDefault();
                  commit(opt);
                }}
                onMouseEnter={() => setHighlight(idx)}
                className={`cursor-pointer px-3 py-2 ${
                  idx === highlight ? "bg-neutral-100" : ""
                }`}
              >
                <span className="font-medium">{opt.label}</span>
                {opt.sublabel && (
                  <span className="ml-2 text-neutral-500 text-xs">
                    {opt.sublabel}
                  </span>
                )}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
