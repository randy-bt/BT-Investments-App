// AppBranding — small fixed BT Investments wordmark in the bottom-left
// corner of every internal app page. DESKTOP ONLY since 8/13
// (agent-requests #11): on a phone that corner belongs to the menu button,
// and Randy did not want the wordmark rendered at mobile widths at all. Purely decorative: non-interactive
// (pointer-events-none) so it never blocks clicks, subtle opacity, and it
// mirrors the marketing brand (BT in Cormorant serif + wide-tracked olive
// INVESTMENTS). The Indica floating button owns the bottom-right corner.
export function AppBranding() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed bottom-3 left-4 z-40 hidden select-none opacity-50 md:block dark:opacity-40"
    >
      <div
        className="leading-none tracking-tight text-neutral-700 dark:text-neutral-300"
        style={{
          fontFamily: "var(--font-cormorant), Georgia, serif",
          fontSize: "1.05rem",
          fontWeight: 500,
        }}
      >
        BT
      </div>
      <div
        className="mt-0.5 uppercase tracking-[0.28em]"
        style={{ color: "#76794c", fontSize: "0.4rem", fontWeight: 600 }}
      >
        Investments
      </div>
    </div>
  );
}
