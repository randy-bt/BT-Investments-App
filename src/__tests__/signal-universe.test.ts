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
    expect(intakeSrc).toContain("Just begin speaking.");
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

  it("FAQ has the 22 questions (12 original + handoff 013); the intake link is gone (Randy 7/15)", () => {
    expect(faqSrc.match(/q: "/g)).toHaveLength(22);
    expect(faqSrc).toContain("FAQPage");
    expect(intakeSrc).not.toContain("Questions? Read the FAQ");
  });
});

describe("pixel funnel events (handoff 014)", () => {
  const pixelSrc = read("../components/signal/MetaPixel.tsx");

  it("exposes the two intermediate funnel events", () => {
    expect(pixelSrc).toContain('fbq("trackCustom", "SignalStarted", { method })');
    expect(pixelSrc).toContain('fbq("trackCustom", "SignalComposed", { method })');
  });

  it("the campaign conversion events are unchanged", () => {
    expect(pixelSrc).toContain('fbq("trackCustom", "SignalSubmission")');
    expect(pixelSrc).toContain('fbq("track", "Lead")');
  });

  it("SignalStarted is guarded to once per method per visit", () => {
    expect(intakeSrc).toContain("startedRef");
    expect(intakeSrc).toMatch(/if \(!startedRef\.current\[which\]\)[\s\S]{0,120}trackSignalStarted\(which\)/);
  });

  it("SignalComposed fires on both paths, only when the stage advances", () => {
    // After the guard clause in each, never in goBack.
    expect(intakeSrc).toContain('trackSignalComposed("type")');
    expect(intakeSrc).toContain('trackSignalComposed("voice")');
    const goBack = intakeSrc.slice(intakeSrc.indexOf("function goBack"));
    expect(goBack.slice(0, goBack.indexOf("\n  }"))).not.toMatch(/track/);
  });

  it("advanced matching passes contact fields for in-browser hashing", () => {
    expect(intakeSrc).toMatch(/trackSignalSubmission\(\{[\s\S]{0,120}email,/);
    for (const key of ["userData.em", "userData.ph", "userData.fn"]) {
      expect(pixelSrc).toContain(key);
    }
  });
});

describe("restriction-proof funnel (handoff 015)", () => {
  const pixelSrc = read("../components/signal/MetaPixel.tsx");
  const funnelSrc = read("../lib/signal-funnel.ts");
  const routeSrc = read("../app/api/signal/funnel/route.ts");
  const migrationSrc = read("../../supabase/migrations/078_signal_funnel_events.sql");

  // Part 1: standard events cannot be blocked by the new-custom-event
  // restriction, so each custom event now fires one alongside it.
  it("mirrors both custom funnel events onto Meta standard events", () => {
    expect(pixelSrc).toMatch(
      /fbq\("trackCustom", "SignalStarted", \{ method \}\);\s*\n\s*fbq\("track", "InitiateCheckout"\)/
    );
    expect(pixelSrc).toMatch(
      /fbq\("trackCustom", "SignalComposed", \{ method \}\);\s*\n\s*fbq\("track", "AddPaymentInfo"\)/
    );
  });

  it("keeps the custom events and the existing Lead mirror intact", () => {
    expect(pixelSrc).toContain('fbq("trackCustom", "SignalStarted", { method })');
    expect(pixelSrc).toContain('fbq("trackCustom", "SignalComposed", { method })');
    expect(pixelSrc).toContain('fbq("trackCustom", "SignalSubmission")');
    expect(pixelSrc).toContain('fbq("track", "Lead")');
  });

  // Part 2: our own counters, independent of Meta.
  it("logs all three steps from the same places as the pixel", () => {
    expect(intakeSrc).toContain('logFunnelStep("started", which)');
    expect(intakeSrc).toContain('logFunnelStep("composed", "type")');
    expect(intakeSrc).toContain('logFunnelStep("composed", "voice")');
    expect(intakeSrc).toContain('logFunnelStep("submitted")');
  });

  it("started stays inside the once-per-method guard", () => {
    expect(intakeSrc).toMatch(
      /if \(!startedRef\.current\[which\]\)[\s\S]{0,160}logFunnelStep\("started", which\)/
    );
    const goBack = intakeSrc.slice(intakeSrc.indexOf("function goBack"));
    expect(goBack.slice(0, goBack.indexOf("\n  }"))).not.toContain("logFunnelStep");
  });

  it("is fire and forget: never awaited, failures swallowed", () => {
    expect(funnelSrc).toContain("keepalive: true");
    expect(funnelSrc).toMatch(/\.catch\(\(\) => \{\}\)/);
    // An await here would put the network on the submit path.
    expect(funnelSrc).not.toMatch(/await fetch/);
    expect(intakeSrc).not.toMatch(/await logFunnelStep/);
  });

  it("ties one visit's steps together with a per-visit session id", () => {
    expect(funnelSrc).toContain("sessionStorage");
    expect(funnelSrc).toContain("crypto.randomUUID");
    expect(migrationSrc).toMatch(/session_id\s+TEXT NOT NULL/);
  });

  it("carries zero personal data end to end", () => {
    // The route accepts three fields and drops everything else.
    expect(routeSrc).toMatch(/step:\s*z\.enum\(\['started', 'composed', 'submitted'\]\)/);
    expect(routeSrc).toMatch(/method:\s*z\.enum\(\['voice', 'type'\]\)/);
    expect(routeSrc).toMatch(/session_id:\s*z\.string\(\)/);
    // Check the code, not the prose: the comments in these files talk about
    // the personal fields precisely to say they are excluded.
    const stripComments = (s: string) =>
      s.replace(/^\s*(--|\/\/).*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
    for (const src of [funnelSrc, routeSrc, migrationSrc]) {
      const code = stripComments(src);
      for (const field of ["email", "phone", "message_text", "business_name", "ip_address"]) {
        expect(code).not.toContain(field);
      }
    }
  });

  it("the table constrains step and method to the known vocabulary", () => {
    expect(migrationSrc).toContain("CHECK (step IN ('started', 'composed', 'submitted'))");
    expect(migrationSrc).toContain("CHECK (method IN ('voice', 'type'))");
    expect(migrationSrc).toContain("ENABLE ROW LEVEL SECURITY");
    expect(migrationSrc).toContain("GRANT ALL ON signal_funnel_events TO service_role");
  });
});

describe("signal auto-reply (handoff 017)", () => {
  const tplSrc = read("../lib/emails/signal-auto-reply.ts");
  const emailSrc = read("../lib/email.ts");
  const submitSrc = read("../app/api/signal/submit/route.ts");

  it("uses the approved subject and the signal@ identity", () => {
    expect(tplSrc).toContain("SIGNAL_AUTO_REPLY_SUBJECT = 'Signal: we got your message'");
    // From and Reply-To both signal@, so a reply lands in the monitored inbox.
    expect(emailSrc).toMatch(/sendSignalAutoReply[\s\S]*?from: `Signal <\$\{SIGNAL_INBOX\}>`/);
    expect(emailSrc).toMatch(/sendSignalAutoReply[\s\S]*?replyTo: SIGNAL_INBOX/);
  });

  it("sends both an HTML and a plain-text part", () => {
    expect(emailSrc).toMatch(/sendSignalAutoReply[\s\S]*?html: SIGNAL_AUTO_REPLY_HTML/);
    expect(emailSrc).toMatch(/sendSignalAutoReply[\s\S]*?text: SIGNAL_AUTO_REPLY_TEXT/);
  });

  it("carries the approved markup unrestyled", () => {
    // Palette and structure Randy signed off on. Changing any of these means
    // the template drifted from SIGNAL/email/auto-reply.html.
    for (const token of [
      "background:#f3f1ec",           // canvas
      "background:#ffffff",           // card
      "color:#161614",                // ink
      "background:#10b981",           // emerald dot and rule
      "font-family:Georgia,'Times New Roman',serif;font-style:italic", // hero
      'role="presentation"',          // table-based on purpose
      "@media (max-width:600px)",     // the mobile rule must survive
    ]) {
      expect(tplSrc).toContain(token);
    }
  });

  it("says a person is still coming, and promises no timeline", () => {
    expect(tplSrc).toContain("A real person reads every one of these");
    expect(tplSrc).toContain("We will be in touch");
    // Out of scope per the handoff: never add a turnaround promise.
    expect(tplSrc).not.toMatch(/24 hours|within a day|same day|shortly/i);
    // No personalized salutation: name is optional on the form.
    expect(tplSrc).not.toMatch(/\{\{|\$\{name|Hi there,|Dear /);
  });

  it("fires from the submit route, guarded and best-effort", () => {
    expect(submitSrc).toContain("sendSignalAutoReply");
    // Only with an address, even though the schema requires one today.
    expect(submitSrc).toMatch(/if \(submitterEmail\)[\s\S]{0,200}sendSignalAutoReply/);
    // A failure is logged, never thrown, so the submission still succeeds.
    expect(submitSrc).toMatch(/autoReply\.success[\s\S]{0,120}console\.error/);
    const after = submitSrc.slice(submitSrc.indexOf("sendSignalAutoReply"));
    expect(after).toContain("NextResponse.json({ success: true");
  });

  it("leaves Randy's internal notification untouched", () => {
    expect(emailSrc).toContain("export async function sendSignalNotification");
    expect(emailSrc).toMatch(/sendSignalNotification[\s\S]*?to: SIGNAL_INBOX/);
    expect(emailSrc).toMatch(/sendSignalNotification[\s\S]*?replyTo: opts\.email/);
    expect(submitSrc).toContain("sendSignalNotification({");
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
