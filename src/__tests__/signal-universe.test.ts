import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { PAL, WORDS } from "@/components/signal/SignalUniverse";

// Handoff 002 locked-copy laws. The visual/motion laws are verified in the
// browser; these guard the parts a refactor could silently break.

const componentSource = readFileSync(
  join(__dirname, "../components/signal/SignalUniverse.tsx"),
  "utf8"
);

describe("signal universe (handoff 002)", () => {
  it("word pool is the reference's 82 entries, no duplicates", () => {
    expect(WORDS).toHaveLength(82);
    expect(new Set(WORDS).size).toBe(82);
  });

  it("palette is the reference's 10 vibrant hues", () => {
    expect(PAL).toHaveLength(10);
    for (const c of PAL) expect(c).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("copy contains no em-dashes or en-dashes (Randy's standing rule)", () => {
    expect(componentSource).not.toMatch(/[—–]/);
  });

  it("beat copy matches the handoff word for word", () => {
    expect(componentSource).toContain("Your business on one side. AI on the other.");
    expect(componentSource).toContain("We&rsquo;re the bridge.");
    expect(componentSource).toContain("Just a few examples. The list never ends.");
    expect(componentSource).toContain("Tell us what you need");
  });

  it("performance law: shadowBlur is never set in the engine", () => {
    // the reference's comment mentions the API by name; only assignments count
    expect(componentSource).not.toMatch(/\.shadowBlur\s*=/);
  });

  it("performance law: devicePixelRatio capped at 1.5", () => {
    expect(componentSource).toContain("Math.min(devicePixelRatio || 1, 1.5)");
  });
});
