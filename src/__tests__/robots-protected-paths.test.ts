import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

// TRAINING-CORPUS GUARD FOR THE STATIC DROPS (Geoffrey/Randy, Sept 2026).
//
// Written after /shoot-briefs sat outside robots.txt for a month. It shipped
// in August with a noindex meta, which made it LOOK protected, and nobody
// noticed the robots entry was never added. noindex governs indexing, not
// fetching: it kept the page out of search results and did nothing to keep
// Infinite Media production detail out of five AI training corpora.
//
// The trap is structural, not careless. robots.txt named groups REPLACE the
// wildcard group rather than adding to it, so "Disallow: /x" at the top
// protects nothing from GPTBot. Six near-identical blocks have to stay in
// sync by hand, and a comment asking nicely is what failed last time.
//
// So this test DERIVES the protected set from next.config.ts instead of
// hardcoding it. Add a /whatever/:slug -> /whatever/:slug.html drop and this
// starts requiring it in all six groups on the next run, with no one having
// to remember. That is the whole point; do not replace the derivation with a
// literal list.

const root = join(__dirname, "..", "..");
const config = readFileSync(join(root, "next.config.ts"), "utf8");
const robots = readFileSync(join(root, "public", "robots.txt"), "utf8");

// Every static file drop: { source: "/x/:slug", destination: "/x/:slug.html" }.
// The .html destination is what distinguishes a drop from an ordinary rewrite
// such as /signal/flyer -> /signal, which is a live route and IS meant to be
// crawled.
function staticDrops(): string[] {
  const re =
    /source:\s*"(\/[A-Za-z0-9-]+)\/:slug",\s*destination:\s*"\/[A-Za-z0-9-]+\/:slug\.html"/g;
  return [...config.matchAll(re)].map((m) => m[1]);
}

const GROUP_COUNT = 6; // wildcard + GPTBot, OAI-SearchBot, ClaudeBot, PerplexityBot, Google-Extended

describe("robots.txt protects every static drop from every crawler", () => {
  it("still finds the drops (guards the derivation itself)", () => {
    // If a refactor changes the rewrite shape, every assertion below would
    // pass vacuously on an empty list. Fail loudly instead.
    const drops = staticDrops();
    expect(drops.length).toBeGreaterThanOrEqual(5);
    expect(drops).toEqual(expect.arrayContaining([
      "/proposals",
      "/proofs",
      "/shoot-briefs",
      "/internal",
      "/briefs",
    ]));
  });

  it("has exactly the six user-agent groups the exclusions are counted against", () => {
    expect(robots.match(/^User-agent:/gm) ?? []).toHaveLength(GROUP_COUNT);
  });

  it.each(staticDrops())(
    "excludes %s from all six groups, not just the wildcard",
    (prefix) => {
      const lines = robots.match(
        new RegExp(`^Disallow: ${prefix}$`, "gm"),
      ) ?? [];
      expect(
        lines.length,
        `${prefix} appears in ${lines.length}/${GROUP_COUNT} robots groups. ` +
          `Named groups REPLACE the wildcard, so anything short of ${GROUP_COUNT} ` +
          `leaves it readable by at least one AI crawler.`,
      ).toBe(GROUP_COUNT);
    },
  );

  it("keeps the sitemap free of every drop", () => {
    const sitemap = readFileSync(join(root, "src", "app", "sitemap.ts"), "utf8");
    for (const prefix of staticDrops()) {
      expect(sitemap, `${prefix} must not be advertised in the sitemap`)
        .not.toContain(prefix);
    }
  });
});
