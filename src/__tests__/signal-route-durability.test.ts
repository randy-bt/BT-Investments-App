import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "fs";
import { join } from "path";

// PRINTED QR CODE GUARD (Randy, Aug 2026).
//
// 1,000 physical Signal cards are in circulation, each encoding
// https://btinvestments.co/signal?utm_source=flyer&utm_medium=qr
//
// Paper cannot be re-pointed. These tests fail loudly if a future refactor
// would turn every one of those cards into a 404. A comment alone does not
// survive a confident refactor; this does.

const root = join(__dirname, "..", "..");
const routeFile = join(root, "src", "app", "signal", "page.tsx");

describe("/signal route durability (printed QR codes point here)", () => {
  it("keeps /signal resolvable, either as a route or as a permanent redirect", () => {
    const routeExists = existsSync(routeFile);
    const cfg = readFileSync(join(root, "next.config.ts"), "utf8");
    // If the route is ever removed, a redirects() entry mentioning /signal
    // must take its place. One or the other must always be true.
    const hasSignalRedirect = /async\s+redirects\s*\(/.test(cfg) && cfg.includes("/signal");
    expect(
      routeExists || hasSignalRedirect,
      "/signal must resolve: printed QR cards point at it and cannot be changed",
    ).toBe(true);
  });

  it("does not read searchParams, so flyer UTM params cannot alter the page", () => {
    if (!existsSync(routeFile)) return; // covered by the redirect case above
    // Strip comments first: the banner in that file *discusses* searchParams,
    // and matching prose instead of code would make this test meaningless.
    const code = readFileSync(routeFile, "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    expect(code).not.toMatch(/\bsearchParams\b/);
  });

  it("keeps the case-insensitive rescue for typed URLs (/SIGNAL, /Signal)", () => {
    const proxy = readFileSync(join(root, "src", "proxy.ts"), "utf8");
    // Humans typing the URL off a printed card produce /Signal and /SIGNAL.
    // Paths are case-sensitive, so without this they 404 for 12+ months.
    expect(proxy).toMatch(/CASE-INSENSITIVE RESCUE FOR THE PRINTED QR PATH/);
    expect(proxy).toMatch(/lowerPath === '\/signal' \|\| lowerPath\.startsWith\('\/signal\/'\)/);
    // Must stay a redirect that preserves the query string, or utm_source is
    // lost on the hop and the scan stops attributing to the flyer.
    expect(proxy).toMatch(/canonical = request\.nextUrl\.clone\(\)/);
    expect(proxy).toMatch(/NextResponse\.redirect\(canonical, 308\)/);
  });

  it("keeps /signal public: it must not be captured as an app-only path", () => {
    const proxy = readFileSync(join(root, "src", "proxy.ts"), "utf8");
    // /signal is public via the default-allow fall-through. If someone adds a
    // rule that routes bare /signal into the authenticated app, the flyer dies.
    // Note: the case-rescue above matches on lowerPath, not pathname, so this
    // still only catches someone routing bare /signal into the app.
    expect(proxy).not.toMatch(/pathname\.startsWith\(['"]\/signal['"]\)/);
    expect(proxy).toMatch(/PRINTED QR CODE DEPENDENCY/);
  });
});
