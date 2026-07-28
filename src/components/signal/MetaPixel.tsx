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

// Funnel instrumentation (handoff 014): PageView tells us someone landed
// and SignalSubmission tells us they finished, but the middle was dark.
// These two read the drop-off: bounce, gave up at the composer, or walked
// at the very last screen. Instrumentation only; the campaign still
// optimizes on SignalSubmission.

// Fired when the visitor picks an input method (leaves the chooser). The
// first real signal of intent beyond loading the page.
export function trackSignalStarted(method: "voice" | "type") {
  const fbq = ensureFbq();
  if (!fbq) return;
  fbq("trackCustom", "SignalStarted", { method });
}

// Fired when the visitor has described their problem and the contact
// stage opens. The near-miss detector: anyone who fires this but never
// fires SignalSubmission reached the last screen and walked.
export function trackSignalComposed(method: "voice" | "type") {
  const fbq = ensureFbq();
  if (!fbq) return;
  fbq("trackCustom", "SignalComposed", { method });
}

// Fired exactly when a submission is confirmed (200 back, "Got it." about
// to render), never on button click. SignalSubmission is what the ad
// campaign optimizes on; Lead rides along for Meta's standard surfaces.
//
// Advanced matching (handoff 014 section 2, Randy approved 7/28): re-init
// with the contact details first. fbevents.js normalizes and SHA-256
// hashes them IN THE BROWSER before any network call, so raw values never
// leave the device; Meta uses the hashes to match the lead back to the ad
// click, which lifts both attribution and targeting quality.
export function trackSignalSubmission(contact?: {
  name?: string;
  email?: string;
  phone?: string;
}) {
  const fbq = ensureFbq();
  if (!fbq) return;
  if (contact && PIXEL_ID) {
    // Only send the keys we actually have; empty optional fields are
    // omitted rather than passed as empty strings.
    const userData: Record<string, string> = {};
    const em = contact.email?.trim().toLowerCase();
    const ph = contact.phone?.replace(/\D/g, "");
    const fn = contact.name?.trim().split(/\s+/)[0]?.toLowerCase();
    if (em) userData.em = em;
    if (ph) userData.ph = ph;
    if (fn) userData.fn = fn;
    if (Object.keys(userData).length > 0) fbq("init", PIXEL_ID, userData);
  }
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
