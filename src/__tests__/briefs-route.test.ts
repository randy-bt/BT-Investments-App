import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync } from "fs";
import { join } from "path";

// CLIENT BRIEF DROP GUARD (Geoffrey/Randy, Sept 2026).
//
// /briefs/<slug> serves static HTML from public/briefs. These are working
// documents handed to a CLIENT by link: unlisted, not indexed, and not for
// training corpora. The whole drop is three small pieces of config that have
// nothing tying them together at runtime, so a refactor can silently break
// one and leave the other two looking fine. That is what these lock down:
//
//   1. the rewrite exists and still points at the .html file
//   2. the drop stays parameterised, so a new brief is a file drop
//   3. an unknown slug 404s instead of hitting a catch-all
//   4. robots.txt excludes /briefs in EVERY group, not just the wildcard
//   5. nothing under /briefs reaches the sitemap

const root = join(__dirname, "..", "..");
const cfg = () => readFileSync(join(root, "next.config.ts"), "utf8");
const robots = () => readFileSync(join(root, "public", "robots.txt"), "utf8");
const briefsDir = join(root, "public", "briefs");

describe("/briefs/<slug> static drop", () => {
  it("rewrites /briefs/:slug to the .html file, hiding the extension", () => {
    expect(cfg()).toMatch(
      /source:\s*"\/briefs\/:slug",\s*destination:\s*"\/briefs\/:slug\.html"/,
    );
  });

  it("stays parameterised, so the next brief is a file drop and not a code change", () => {
    // A per-slug rewrite would mean editing next.config.ts for every client
    // document. If someone "fixes" the drop by hardcoding slugs, catch it.
    const briefRewrites = cfg().match(/source:\s*"\/briefs\/[^"]*"/g) ?? [];
    expect(briefRewrites).toEqual(['source: "/briefs/:slug"']);
  });

  it("404s on an unknown slug: no index fallback can swallow one", () => {
    // The rewrite sends an unknown slug to a file that does not exist, which
    // Next 404s. That only holds while public/briefs has no index.html and
    // the rewrite has no catch-all. Both would turn a typo into a 200 that
    // serves SOME OTHER client's brief.
    expect(existsSync(join(briefsDir, "index.html"))).toBe(false);
    expect(cfg()).not.toMatch(/source:\s*"\/briefs\/:slug\*/);
    expect(cfg()).not.toMatch(/source:\s*"\/briefs\/:path\*/);
  });

  it("serves every brief as a real file on disk", () => {
    expect(existsSync(briefsDir)).toBe(true);
    const files = readdirSync(briefsDir);
    expect(files.length).toBeGreaterThan(0);
    // Only .html is reachable through the rewrite; anything else in here is
    // either dead weight or something that was meant to be served and is not.
    expect(files.filter((f) => !f.endsWith(".html"))).toEqual([]);
  });

  it("keeps every brief out of AI training corpora, in all six robots groups", () => {
    const txt = robots();
    // Each named crawler group REPLACES the wildcard group rather than adding
    // to it, so a single Disallow at the top protects nothing from GPTBot et
    // al. The count is the test: wildcard + five named groups.
    const groups = txt.match(/^User-agent:/gm) ?? [];
    expect(groups).toHaveLength(6);
    expect(txt.match(/^Disallow: \/briefs$/gm) ?? []).toHaveLength(6);
  });

  it("never lists a brief in the sitemap", () => {
    const sitemap = readFileSync(join(root, "src", "app", "sitemap.ts"), "utf8");
    expect(sitemap).not.toContain("/briefs");
  });

  it("ships each brief with its own noindex meta, independent of robots.txt", () => {
    // robots.txt asks a crawler not to FETCH; it does not stop a URL that was
    // shared or linked from being indexed. The meta tag is the second lock,
    // and it is the only one that travels with the file.
    for (const f of readdirSync(briefsDir).filter((x) => x.endsWith(".html"))) {
      const html = readFileSync(join(briefsDir, f), "utf8");
      expect(html, `${f} is missing its noindex meta`).toMatch(
        /<meta\s+name=["']robots["']\s+content=["'][^"']*noindex/i,
      );
    }
  });
});
