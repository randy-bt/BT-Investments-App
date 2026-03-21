"use client";

export function HomeSearch() {
  function openSearch() {
    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: "k", metaKey: true })
    );
  }

  return (
    <button
      type="button"
      onClick={openSearch}
      className="flex w-full items-center rounded-md border border-neutral-300 bg-white px-3 py-2 text-left shadow-sm hover:border-neutral-400 focus:border-neutral-400 focus:outline-none"
    >
      <svg
        className="text-neutral-400 pointer-events-none"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
    </button>
  );
}
