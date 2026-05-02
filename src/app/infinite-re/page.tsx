import type { Metadata } from "next";
import Link from "next/link";
import HelloShell from "@/components/HelloShell";

export const metadata: Metadata = {
  title: "Infinite RE | BT Investments",
};

/**
 * Standalone landing for /infinite-re — Infinite RE doesn't have a
 * full Hello-portal screen yet (the rest of the brand is still being
 * built out), so this shows a brand-consistent placeholder until the
 * real product is ready. Existing form scaffold lives at
 * /infinite-re/form and is unchanged.
 */
export default function InfiniteRePage() {
  return (
    <HelloShell>
      <div className="h-screen h-[100dvh] w-full flex flex-col items-center justify-center bg-[#e9e6dd] px-6 text-center">
        <div className="flex flex-col items-center gap-6 max-w-lg">
          <h1
            className="font-serif text-[clamp(3rem,7vw,5.5rem)] text-[#161616] leading-[0.95] tracking-tight"
          >
            Infinite{" "}
            <span className="italic text-[#b49a5c] font-medium">RE</span>
          </h1>
          <p className="font-sans text-[16px] text-[#555] leading-relaxed">
            A new chapter is on the way. Watch this space.
          </p>
          <Link
            href="/hello"
            className="mt-4 px-6 py-3 rounded-full bg-[#161616] text-white font-sans text-[14px] font-medium hover:bg-[#333] transition-colors"
          >
            ← Back to Hello
          </Link>
        </div>
      </div>
    </HelloShell>
  );
}
