import type { Metadata } from "next";
import { HelloReturnX } from "@/components/HelloReturnX";

/**
 * Infinite RE shell — minimal. Header and footer were removed
 * intentionally so the homepage's edge-to-edge black/white split
 * isn't broken up by chrome on the page. The contact page provides
 * its own in-page back link.
 *
 * HelloReturnX renders a fixed top-right close button that takes the
 * user back to /hello — but only when the from-hello sessionStorage
 * flag is set (i.e., the user actually came in via the portal).
 * Direct visitors via marketing links never see it.
 */

export const metadata: Metadata = {
  title: "Infinite RE",
  description:
    "Infinite RE — luxury real estate photography, video, and brand content.",
};

export default function InfiniteReLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className="h-screen h-[100dvh] w-full flex flex-col overflow-hidden"
      style={{
        background: "#ffffff",
        color: "#161614",
        fontFamily: "var(--font-inter), system-ui, sans-serif",
      }}
    >
      <main className="flex-1 flex flex-col min-h-0">{children}</main>
      <HelloReturnX variant="dark" />
    </div>
  );
}
