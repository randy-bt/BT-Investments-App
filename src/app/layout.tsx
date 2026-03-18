import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BT Investments – Wireframe",
  description: "Phase 1 structural prototype for BT Investments.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-neutral-100 text-neutral-900 antialiased">
        {children}
      </body>
    </html>
  );
}
