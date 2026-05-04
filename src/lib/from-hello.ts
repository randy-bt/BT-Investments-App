/**
 * Tracks whether the user reached a sub-site (Infinite RE / Infinite
 * Media / Signal) via the /hello portal vs. landing on it directly.
 *
 * Set whenever the user clicks a card in /hello that leads to a
 * sub-site. Read by sub-sites to decide whether to render a close-X
 * that returns the user to /hello — direct visitors don't see one.
 *
 * Stored in sessionStorage so it clears when the tab closes but
 * survives within-tab navigation and refreshes.
 */

const KEY = "fromHello";

export function markFromHello(): void {
  if (typeof window !== "undefined") {
    try {
      window.sessionStorage.setItem(KEY, "1");
    } catch {
      // Private mode / quota — silently no-op; X just won't show.
    }
  }
}

export function readFromHello(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.sessionStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}
