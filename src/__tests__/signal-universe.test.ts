import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { PAIRS, PAL, WORDS } from "@/components/signal/SignalUniverse";

// Locked-copy laws from handoffs 002/003/003a/005. The visual/motion laws
// are verified in the browser; these guard what a refactor could silently
// break: exact copy, no em-dashes, no public pricing, the perf laws.

const read = (p: string) => readFileSync(join(__dirname, p), "utf8");
const universeSrc = read("../components/signal/SignalUniverse.tsx");
const intakeSrc = read("../components/signal/SignalIntake.tsx");
const pageSrc = read("../app/signal/page.tsx");
const faqSrc = read("../app/signal/faq/page.tsx");

describe("signal universe (handoffs 002 + 005)", () => {
  it("word pool is the reference's 82 entries, no duplicates", () => {
    expect(WORDS).toHaveLength(82);
    expect(new Set(WORDS).size).toBe(82);
  });

  it("palette is the reference's 10 poster-brand hues", () => {
    expect(PAL).toHaveLength(10);
    for (const c of PAL) expect(c).toMatch(/^#[0-9a-fA-F]{6}$/);
  });

  it("transformation stage has the 12 approved pairs", () => {
    expect(PAIRS).toHaveLength(12);
    expect(PAIRS[0]).toEqual(["Calls go to voicemail.", "Missed Call Recovery"]);
    for (const [prob, sol] of PAIRS) {
      expect(prob.length).toBeGreaterThan(0);
      expect(sol.length).toBeGreaterThan(0);
    }
  });

  it("beat copy matches the handoff word for word", () => {
    // Randy 7/15: the hero sentences are span-wrapped so they can stack on
    // phones; the copy itself is unchanged.
    expect(universeSrc).toContain("Your business on one side.");
    expect(universeSrc).toContain("AI on the other.");
    expect(universeSrc).toContain("We&rsquo;re the bridge.");
    // Randy 7/16: beat 2 subtitle replaced the "just a few examples" line;
    // the finale asks the action question with a shorter button.
    expect(universeSrc).toContain("Just tell us what your business needs.");
    expect(universeSrc).not.toContain("These are just a few examples.");
    expect(universeSrc).toContain("build</em> for you?");
    expect(universeSrc).toContain("Let&rsquo;s find out");
    expect(universeSrc).not.toContain("Tell us what you need");
  });

  it("performance law: shadowBlur is never set in the engine", () => {
    expect(universeSrc).not.toMatch(/\.shadowBlur\s*=/);
  });

  it("performance law: devicePixelRatio capped at 1.5", () => {
    expect(universeSrc).toContain("Math.min(devicePixelRatio || 1, 1.5)");
  });
});

describe("signal landing (handoffs 004 + 005 copy locks)", () => {
  it("chooser and voice copy match the reference word for word", () => {
    expect(intakeSrc).toContain("Whatever your business needs.");
    expect(intakeSrc).toContain("Talk it out");
    expect(intakeSrc).toContain("Tell us what your business needs.");
    expect(intakeSrc).toContain("Type it out");
    expect(intakeSrc).toContain("Write it in a few sentences.");
    expect(intakeSrc).toContain("Ready when you are.");
    expect(intakeSrc).toContain("We're listening. Take your time.");
    expect(intakeSrc).toContain(
      "That's the 20 minute mark, so we saved this note. Add another if there's more."
    );
    expect(intakeSrc).toContain("Record it first. Even twenty seconds helps.");
    expect(intakeSrc).toContain(
      "Just talk. Describe your business and the problem you want gone."
    );
  });

  it("SEO copy matches handoff 003 word for word", () => {
    expect(pageSrc).toContain("Signal, Custom AI tools built for your business");
    expect(pageSrc).toContain(
      "Tell us what your business needs in a text, a voice note, or photos. We send back the solution, the tool, and the price."
    );
  });

  it("FAQ has the 12 questions; the intake link is gone (Randy 7/15)", () => {
    expect(faqSrc.match(/q: "/g)).toHaveLength(12);
    expect(faqSrc).toContain("FAQPage");
    expect(intakeSrc).not.toContain("Questions? Read the FAQ");
  });
});

describe("standing rules (Randy)", () => {
  const sources = { universeSrc, intakeSrc, pageSrc, faqSrc };
  it("zero em-dashes or en-dashes in any signal source", () => {
    for (const [name, src] of Object.entries(sources)) {
      expect(src, name).not.toMatch(/[—–]/);
    }
  });

  it("zero dollar figures anywhere public (pricing is internal only)", () => {
    for (const [name, src] of Object.entries(sources)) {
      expect(src, name).not.toMatch(/\$\s?\d/);
    }
  });

  it("no timeline promises or guarantee language in the FAQ", () => {
    expect(faqSrc.toLowerCase()).not.toMatch(/guarantee|money.?back/);
  });
});
