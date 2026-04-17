"use client";

import { useState, useEffect } from "react";

const CURRENT_VERSION = "2.8";

export function VersionLabel() {
  const [showDot, setShowDot] = useState(false);

  useEffect(() => {
    const seenVersion = localStorage.getItem("bt-seen-version");
    if (seenVersion !== CURRENT_VERSION) {
      setShowDot(true);
      localStorage.setItem("bt-seen-version", CURRENT_VERSION);
    }
  }, []);

  return (
    <p className="text-[0.65rem] text-neutral-400 mb-1 flex items-center justify-center gap-1">
      v{CURRENT_VERSION}
      {showDot && (
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-blue-500" />
      )}
    </p>
  );
}
