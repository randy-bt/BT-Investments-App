"use client";

import { useState, useRef } from "react";

export function ExpandableCard({
  children,
  additionalNotes,
}: {
  children: React.ReactNode;
  additionalNotes?: React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  return (
    <div>
      <div
        ref={cardRef}
        className={`rounded-lg border border-dashed border-neutral-300 bg-white p-4 shadow-sm overflow-hidden ${
          expanded ? "" : "resize-y"
        }`}
        style={expanded ? { minHeight: "10rem" } : { minHeight: "10rem", height: "24rem" }}
      >
        <div className="h-full flex flex-col">
          {children}
        </div>
      </div>
      <div className="mt-1 flex items-center gap-3">
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="text-xs text-neutral-400 hover:text-neutral-600 hover:underline"
        >
          {expanded ? "Collapse" : "Show All"}
        </button>
        {additionalNotes && (
          <button
            type="button"
            onClick={() => setShowNotes(!showNotes)}
            className="text-xs text-neutral-400 hover:text-neutral-600 hover:underline"
          >
            {showNotes ? "Hide Additional Notes" : "Additional Notes"}
          </button>
        )}
      </div>
      {showNotes && additionalNotes && (
        <div className="mt-2 rounded-lg border border-dashed border-neutral-300 bg-white p-4 shadow-sm"
          style={{ minHeight: "14rem" }}
        >
          {additionalNotes}
        </div>
      )}
    </div>
  );
}
