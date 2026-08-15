import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import {
  Source_Code_Pro,
  Cormorant_Garamond,
  Inter,
  Raleway,
  DM_Serif_Display,
  Quicksand,
  Comfortaa,
  Nunito_Sans,
} from "next/font/google";
import "./globals.css";

const sourceCodePro = Source_Code_Pro({
  subsets: ["latin"],
  variable: "--font-source-code-pro",
});

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-cormorant",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "900"],
  variable: "--font-inter",
});

const raleway = Raleway({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-raleway",
});

// DM Serif Display ships only at 400 (it's a display face that's
// already heavy by nature). Used on the Hello "Join our buyers list" /
// "Sell your property" cards for a heavier, more confident headline.
const dmSerifDisplay = DM_Serif_Display({
  subsets: ["latin"],
  weight: ["400"],
  style: ["normal", "italic"],
  variable: "--font-dm-serif-display",
});

const quicksand = Quicksand({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-quicksand",
});

const comfortaa = Comfortaa({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-comfortaa",
});

const nunitoSans = Nunito_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  variable: "--font-nunito-sans",
});

export const metadata: Metadata = {
  // metadataBase lets every page declare its canonical as a path; Next
  // resolves them against this. Audit 001: canonicals were missing on 15
  // of 17 public pages.
  metadataBase: new URL("https://btinvestments.co"),
  // The template appends the brand to pages that set a plain-string
  // title ("FAQ" renders as "FAQ | BT Investments"). Sub-brand pages
  // (Signal, Infinite Media, Infinite RE, Hello) opt out with
  // `title: { absolute: ... }` so they keep their own identity.
  title: {
    default: "BT Investments",
    template: "%s | BT Investments",
  },
  // The old default ("Real estate investment management platform") was
  // repeated on 9 pages and described the internal app, not what a
  // seller or buyer landing here actually gets. Pages override this
  // with their own; this is the fallback.
  description:
    "BT Investments buys houses across Washington for cash. Fair offers, no repairs, no fees, and you pick the closing date.",
  // Meta domain verification (handoff 010): must be server-rendered in
  // <head> on the homepage; Geoffrey clicks "Verify domain" in Meta
  // Business settings after each deploy that carries it.
  verification: {
    other: {
      "facebook-domain-verification": "05zv0znmj8cc5up674w5hftw311428",
    },
  },
};

// Organization schema, site-wide (audit 001: structured data existed only
// on the two Signal pages). Static values only - nothing here is fetched,
// so nothing here can drift wrong on its own.
const ORG_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "BT Investments",
  url: "https://btinvestments.co",
  // /icon.png is Next's file-convention route for src/app/icon.png
  // (1000x1000, verified live). /favicon.ico does not exist here.
  logo: "https://btinvestments.co/icon.png",
  areaServed: { "@type": "State", name: "Washington" },
  sameAs: [],
};

// Hard-prevent iOS Safari's "zoom into the input on focus" behavior.
// The CSS-only fix (16px font-size on inputs) handles most cases, but
// iOS still occasionally zooms on selects, autofocus, or certain field
// types. Pinning maximumScale=1 closes those edge cases definitively.
// Tradeoff: pinch-to-zoom on the page is also disabled.
//
// interactiveWidget: 'resizes-content' tells the browser the on-screen
// keyboard should compress the layout viewport rather than scroll the
// page beneath it. Reduces (doesn't eliminate) the "everything jumps
// up" jolt when an input is focused on iOS / Android.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  interactiveWidget: "resizes-content",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${sourceCodePro.variable} ${cormorant.variable} ${inter.variable} ${raleway.variable} ${dmSerifDisplay.variable} ${quicksand.variable} ${comfortaa.variable} ${nunitoSans.variable}`} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(localStorage.getItem("bt-dark-mode")==="true")document.documentElement.classList.add("dark")}catch(e){}`,
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(ORG_SCHEMA) }}
        />
        {/* Google Sans Flex — variable font used on the Signal landing
            page. Not in next/font/google's typed catalog yet, so loaded
            directly via Google Fonts with preconnect for fast first
            paint. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Google+Sans+Flex:opsz,wght@6..144,100..1000&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-neutral-100 text-neutral-900 antialiased">
        {children}
        {/* Vercel Web Analytics (handoff 011): whole-site page views +
            the signal_submission custom event. Cookieless; coexists with
            the Meta pixel, which only feeds Meta's ad machine. */}
        <Analytics />
      </body>
    </html>
  );
}
