// Our own funnel counters (handoff 015 part 2).
//
// Meta can restrict what Meta sees; it cannot restrict our own database.
// This module is deliberately independent of MetaPixel so the drop-off
// numbers survive any future pixel policy change. Same three moments, a
// second channel that nobody else controls.
//
// Fire and forget by contract: every call swallows its own failures and
// nothing here is ever awaited. If the route is down, the intake flow
// must not notice.
//
// No personal data leaves this file. Step, method, session id. That is all.

const SESSION_KEY = "signal-funnel-session";

export type FunnelStep = "started" | "composed" | "submitted";
export type FunnelMethod = "voice" | "type";

function randomId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// One id per visit, reused across the three steps so a single visitor's
// journey can be reassembled. sessionStorage rather than localStorage on
// purpose: this counts visits, not people, and it should die with the tab.
export function getSignalSessionId(): string {
  if (typeof window === "undefined") return "";
  try {
    const existing = window.sessionStorage.getItem(SESSION_KEY);
    if (existing) return existing;
    const id = randomId();
    window.sessionStorage.setItem(SESSION_KEY, id);
    return id;
  } catch {
    // Private mode or storage disabled. Still return an id so the step is
    // counted; it just will not join up with the visitor's other steps.
    return randomId();
  }
}

export function logFunnelStep(step: FunnelStep, method?: FunnelMethod): void {
  if (typeof window === "undefined") return;
  const sessionId = getSignalSessionId();
  if (!sessionId) return;
  try {
    void fetch("/api/signal/funnel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        step,
        method: method ?? null,
        session_id: sessionId,
      }),
      // keepalive so the submitted step still lands if the page is
      // navigating away as it fires.
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Never surface anything to the visitor.
  }
}
