"use client";

import { useEffect } from "react";

// Meta pixel for the /signal route ONLY (handoff 003). Built behind
// NEXT_PUBLIC_META_PIXEL_ID: with the env var unset the component renders
// nothing and the track helpers no-op, so it activates the moment Randy's
// Pixel ID lands. No other routes load this.

const PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID;

type Fbq = (...args: unknown[]) => void;

declare global {
  interface Window {
    fbq?: Fbq & { queue?: unknown[]; loaded?: boolean; version?: string; callMethod?: Fbq };
    _fbq?: unknown;
  }
}

function ensureFbq(): Fbq | null {
  if (typeof window === "undefined" || !PIXEL_ID) return null;
  if (window.fbq) return window.fbq;
  // Standard Meta base-code stub, then the script tag.
  const fbq: Window["fbq"] = function (...args: unknown[]) {
    if (fbq!.callMethod) {
      fbq!.callMethod(...args);
    } else {
      fbq!.queue!.push(args);
    }
  };
  fbq.queue = [] as unknown[];
  fbq.loaded = true;
  fbq.version = "2.0";
  window.fbq = fbq;
  window._fbq = fbq;
  const s = document.createElement("script");
  s.async = true;
  s.src = "https://connect.facebook.net/en_US/fbevents.js";
  document.head.appendChild(s);
  return fbq;
}

// Fired exactly when a submission is confirmed (200 back, "Got it." about
// to render), never on button click. SignalSubmission is what the ad
// campaign optimizes on; Lead rides along for Meta's standard surfaces.
export function trackSignalSubmission() {
  const fbq = ensureFbq();
  if (!fbq) return;
  fbq("trackCustom", "SignalSubmission");
  fbq("track", "Lead");
}

export default function MetaPixel() {
  useEffect(() => {
    const fbq = ensureFbq();
    if (!fbq) return;
    fbq("init", PIXEL_ID);
    fbq("track", "PageView");
  }, []);
  return null;
}
