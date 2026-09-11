"use client";

import { useEffect } from "react";

// SIGNAL UNIVERSE (handoffs 002 + 005): the second half of /signal.
//
// This is a PORT of the <script> engine in
// SIGNAL/design/signal-universe.html, kept nearly verbatim on purpose:
// same function names, same constants, same structure, so that when
// Geoffrey ships an updated reference the diff maps 1:1 onto this file.
// Do not "improve" the tuned values (see the handoffs' laws).
//
// Differences from the reference, all mechanical:
// - element ids carry a sig- prefix; body classes are sig-entered /
//   sig-introdone (the body is shared with the rest of the app)
// - canvas font strings resolve --sig-display (next/font Comfortaa)
//   instead of the reference's base64 @font-face; the engine boots after
//   document.fonts.ready so canvas text never draws a fallback
// - the exit button focuses 001's real composer textarea (only when the
//   visitor came from the type panel, as in the reference)
// - listeners/timeouts/rAF are tracked and disposed on unmount
//   (the reference is a single page that never unmounts)

/* poster brand: ink and taupe carry the field, emerald is the only color */
export const PAL = ["#161614", "#4a4844", "#10B981", "#6b675f", "#0e6f4f", "#161614", "#8a867c", "#10B981", "#3a3733", "#514d45"];
/* the universe vocabulary, per Randy 7/12: mostly problems-fixed in plain everyday words,
   a light dusting of the AI buzzword, zero software jargon. audience = the average owner. */
export const WORDS = [
  "Books itself at 2am", "Invoices chase themselves", "Missed calls text back", "Reviews answered overnight",
  "Quotes out same day", "Leads never go cold", "The phone gets answered", "Paperwork writes itself",
  "Receipts file themselves", "The schedule fills itself", "Estimates follow up alone", "No-shows get reminded",
  "Leads texted in seconds", "Reports every morning", "Questions answered instantly", "Every order tracked",
  "The calendar runs itself", "Emails sort themselves", "Voicemails become bookings", "Photos become quotes",
  "Voice notes become invoices", "Late payers get nudged", "Follow-ups never forgotten", "Customers kept in the loop",
  "Bookings confirm themselves", "The FAQ answers itself", "Photos organize themselves", "Prices found instantly",
  "Warranty claims handled", "Reviews get requested", "The inbox empties itself", "Every caller called back",
  "Documents found in seconds", "Timesheets fill themselves", "Payroll preps itself", "Inventory warns you first",
  "Menus update everywhere", "Bids compared for you", "Contracts drafted in minutes", "Your numbers in your pocket",
  "Nothing slips through", "Weekends stay weekends", "Busy work disappears", "Your best worker never sleeps",
  "New customers while you sleep", "Everything in one place",
  "AI receptionist", "AI answering machine", "Your AI front desk", "AI on your phones",
  "AI in the back office", "AI that knows your prices", "Your first AI employee", "AI trained on your business",
  "AI that never clocks out", "Custom AI, built for you", "AI without the headache", "AI that quotes for you",
  "Online booking", "A better website", "Customer portals", "Job tracking", "Daily reports", "Photo galleries",
  "Live availability", "Appointment reminders", "Review replies", "Quote follow-ups", "Lead capture",
  "Client intake", "Invoicing", "Estimates",
  "Quotes", "Scheduling", "Payroll", "Bookings", "Reminders", "Follow-ups", "Menus", "Receipts", "Reviews", "Timesheets"];

/* beat 2: the transformation (Randy's product lexicon, one pair at a time) */
/* The fifteen pairs of beat 2's waterfall (handoff 020, Randy 9/11, locked
   word for word after 13 rounds). Two rules govern the list if it is ever
   edited: the problem has to be one almost every business has, and each tool
   name carries its own value word (Instant, 24/7, Automatic, Self-Filing),
   with "AI" on at most a third and never on two adjacent names. */
export const PAIRS: Array<[string, string]> = [
  ["The phone rings, your hands are full.", "The AI Receptionist"],
  ["Every quote gets typed up by hand.", "Instant Quote Generator"],
  ["Leads go quiet. Nobody chases them.", "Automatic Follow-Up Agent"],
  ["Contracts take hours. Mistakes slip in.", "AI Contract Generator"],
  ["You find out how the day went too late.", "Daily Business Brief"],
  ["Online reviews sit unanswered.", "24/7 Reputation Manager"],
  ["Receipts and invoices pile up.", "AI Bookkeeper"],
  ["How things get done lives in your head.", "Instant Operations Manual"],
  ["Social media eats hours you don\u2019t have.", "Automated Content Engine"],
  ["R\u00e9sum\u00e9s pile up. The good ones get lost.", "AI Hiring Screener"],
  ["The calendar is chaos.", "Always-On Booking Assistant"],
  ["Files end up everywhere, and nowhere.", "Self-Filing Business Organizer"],
  ["You pay the lawyer twice: once to draft it, once to review it.", "AI Contract Drafter"],
  ["The same forms get filled out by hand.", "Paperwork Autopilot"],
  ["Stock runs out before you notice.", "AI Inventory Tracker"],
];

/* Row 13 is the only problem allowed to wrap; every other line is locked to
   one line on desktop. */
const TWO_LINE_ROW = 12;

/* The three squares and the cards they open. Copy is locked; `line` splits
   into a DM Serif italic half and a Comfortaa emerald bold half. */
type Case = {
  key: string;
  who: string;
  name: string;
  rows: Array<[string, string]>;
  line: [string, string];
};
export const CASES: Case[] = [
  {
    key: "reception",
    who: "A Signal Original, set up for your business.",
    name: "The AI Receptionist",
    rows: [
      ["The job it takes", "The phone rings while your hands are busy. Voicemail loses the caller, and the caller was a customer."],
      ["What it does", "Answers every call from a one-page brief on how your business runs. Books, answers, takes the message, or hands off to you."],
      ["What you see", "A call log, a daily digest, and a short list of the calls that actually need you."],
    ],
    line: ["You switch it on. ", "Your phone stops being a job."],
  },
  {
    key: "quotes",
    who: "For any business that sends quotes.",
    name: "Instant Quote Generator",
    rows: [
      ["The job it takes", "A customer asks for a price. It sits in your head, then your inbox, then a spreadsheet. Days go by."],
      ["What it does", "Takes the details from a text, a photo or a voice note and sends back a clean quote in your prices, in minutes."],
      ["What you see", "Every quote in one list: sent, opened, accepted. The quiet ones get a nudge with one tap."],
    ],
    line: ["The quote goes out today. ", "Before they call the next guy."],
  },
  {
    key: "reviews",
    who: "For any business with a Google page.",
    name: "24/7 Reputation Manager",
    rows: [
      ["The job it takes", "Reviews pile up unanswered. The good ones go unthanked. The bad one sits on top for months."],
      ["What it does", "Answers every review in your voice within the hour, asks happy customers for one at the right moment, and flags the ones that need a human."],
      ["What you see", "Your rating, every review, every reply, and the handful that need you."],
    ],
    line: ["Every review answered, ", "the same day."],
  },
];

type Particle = {
  type: "word" | "dot" | "ring" | "shard";
  depth: number;
  fontStr: string;
  a0: number;
  r0n: number;
  ph: number;
  spd: number;
  size: number;
  color: string;
  word: string;
  swapAt: number;
  swapPh: number;
  chip: null;
  swapped?: boolean;
};

function boot(): () => void {
  const $ = (id: string) => document.getElementById(id)!;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
  const smooth = (v: number, a: number, b: number) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

  /* ---------- unmount bookkeeping (not in the reference: it never unmounts) ---------- */
  const offs: Array<() => void> = [];
  const on = (tgt: EventTarget, ev: string, fn: EventListenerOrEventListenerObject, opts?: AddEventListenerOptions) => {
    tgt.addEventListener(ev, fn, opts);
    offs.push(() => tgt.removeEventListener(ev, fn, opts));
  };
  const timeouts: number[] = [];
  const later = (fn: () => void, ms: number) => { timeouts.push(window.setTimeout(fn, ms)); };

  /* ---------- elements ---------- */
  const landing = $("sig-landing"), world = $("sig-world"), gate = $("sig-gate");
  const canvas = $("sig-field") as HTMLCanvasElement, ctx = canvas.getContext("2d")!;
  const seed = $("sig-seed"), dotsBox = $("sig-dots");
  const hero0 = $("sig-hero0"), finale = $("sig-finale");
  const beat2 = $("sig-beat2");

  /* the app loads real Comfortaa via next/font; canvas font strings resolve it here */
  const DISP = getComputedStyle(world).getPropertyValue("--sig-display").trim() || '"Comfortaa",sans-serif';

  /* unique word checkout so no word appears twice at once */
  let freeWords: string[] = [];
  function shuffleWords(){ freeWords = WORDS.slice(); for (let i = freeWords.length - 1; i > 0; i--){ const j = (Math.random() * (i + 1)) | 0; [freeWords[i], freeWords[j]] = [freeWords[j], freeWords[i]]; } }
  function takeWord(giveBack?: string){
    if (!freeWords.length) shuffleWords();
    const w = freeWords.pop()!;
    if (giveBack) freeWords.unshift(giveBack);
    return w;
  }

  /* ---------- beat 2: the transformation stage ---------- */
  /* Re-read on resize, not just at boot, so rotating an iPad switches the
     field dimming with the layout instead of keeping the phone value. */
  const phoneMQ = matchMedia("(max-width: 640px)");
  let isPhone = phoneMQ.matches;
  on(window, "resize", (() => { isPhone = phoneMQ.matches; }) as EventListener);

  /* ---------- beat 2: the waterfall and the three cards (handoff 020) ---------- */
  const squares = [...beat2.querySelectorAll<HTMLButtonElement>(".sq")];
  const panels = [...beat2.querySelectorAll<HTMLElement>(".panel")];

  /* cardOpen is the gesture law's override. While a card is open the wheel,
     touch and arrow-key handlers return before step() can fire, so the page
     cannot navigate out from under something the visitor just opened. Escape
     still closes. Without this, one trackpad nudge while reading a card jumps
     you to the finale. */
  let cardOpen = false;
  let stageLive = false;

  function closeCard(){
    if (!cardOpen) return;
    cardOpen = false;
    panels.forEach((el) => el.classList.remove("on"));
    squares.forEach((el) => { el.classList.remove("dim"); el.setAttribute("aria-expanded", "false"); });
    /* the waterfall comes back with the card's room */
    beat2.classList.remove("carded");
  }

  function openCard(key: string){
    panels.forEach((el) => el.classList.toggle("on", el.dataset.case === key));
    squares.forEach((el) => {
      const me = el.dataset.case === key;
      el.classList.toggle("dim", !me);
      el.setAttribute("aria-expanded", me ? "true" : "false");
    });
    /* .carded collapses the waterfall so the card fits inside the fixed
       world at 1440x900 and 1280x720 without scrolling. */
    beat2.classList.add("carded");
    cardOpen = true;
  }

  squares.forEach((el) => {
    el.addEventListener("click", () => {
      const key = el.dataset.case || "";
      if (el.getAttribute("aria-expanded") === "true"){ closeCard(); return; }
      openCard(key);
    });
  });
  panels.forEach((el) => {
    el.querySelector(".x")?.addEventListener("click", () => closeCard());
  });

  function stageTick(b2: number){
    if (b2 > .6){
      /* pointer-events live only while beat 2 is up: .sig-world .beat is
         pointer-events:none, and without this gate the invisible squares of
         beat 2 would swallow clicks meant for beats 1 and 3. */
      if (!stageLive){ stageLive = true; beat2.classList.add("live"); }
    } else if (b2 < .25 && stageLive){
      stageLive = false;
      beat2.classList.remove("live");
      /* never leave a half-open beat behind for someone returning from beat 3 */
      closeCard();
    }
  }

  /* ---------- beat system: hero -> the transformation -> the question ---------- */
  const MAX = 2;
  const SNAPS = [0, 1, 2];
  let mode = "landing";          // landing | ritual | universe | ritual-out
  let prog = 0, target = 0, lastInput = 0, exitPull = 0;
  let birth = 0, birthStart = 0, dying = false;

  /* ---------- canvas + particles ---------- */
  let W = 0, H = 0, DPR = 1, CX = 0, CY = 0, R0 = 0;
  const P: Particle[] = [];
  function resize(){
    W = innerWidth; H = innerHeight; DPR = Math.min(devicePixelRatio || 1, 1.5);
    canvas.width = W * DPR; canvas.height = H * DPR;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    CX = W / 2; CY = H / 2; R0 = Math.min(W, H) * 0.62;
  }
  on(window, "resize", resize); resize();

  /* pre-rendered glow sprites: all the light, none of the shadowBlur cost
     (kept from the reference; the cream field no longer draws them) */
  const SPRITES: Record<string, HTMLCanvasElement> = {};
  function glowSprite(color: string){
    if (SPRITES[color]) return SPRITES[color];
    const s = document.createElement("canvas"); s.width = s.height = 64;
    const g = s.getContext("2d")!;
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, color);
    grad.addColorStop(.32, color + "77");
    grad.addColorStop(1, color + "00");
    g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
    SPRITES[color] = s; return s;
  }
  void glowSprite;

  function initParticles(){
    P.length = 0;
    shuffleWords();
    const small = Math.min(W, H) < 640;
    const AMB = small ? 78 : 118;
    for (let i = 0; i < AMB; i++){
      const dr = Math.random();
      const depth = dr < .4 ? .32 : dr < .75 ? .6 : 1;
      const tr = Math.random();
      const type = tr < .46 ? "word" : tr < .76 ? "dot" : tr < .88 ? "ring" : "shard";
      const sz = type === "word" ? (depth === 1 ? 13 + Math.random() * 5 : depth === .6 ? 11 : 9)
             : type === "dot" ? (1.6 + Math.random() * 2.6) * (depth === 1 ? 1.25 : 1)
             : type === "ring" ? 3.5 + Math.random() * 5
             : 2 + Math.random() * 2.4;
      P.push({
        type, depth,
        fontStr: '700 ' + sz + 'px ' + DISP,
        a0: Math.random() * Math.PI * 2,
        r0n: .3 + Math.random() * .82,
        ph: Math.random() * Math.PI * 2,
        spd: .00016 + Math.random() * .00028,
        size: sz,
        color: PAL[i % PAL.length],
        word: type === "word" ? takeWord() : "",
        swapAt: performance.now() + 4000 + Math.random() * 10000,
        swapPh: 0, chip: null
      });
    }
  }
  initParticles();

  /* ---------- progress dots ---------- */
  dotsBox.textContent = "";
  SNAPS.forEach((s, i) => {
    const b = document.createElement("button");
    b.setAttribute("aria-label", "Go to scene " + (i + 1));
    b.addEventListener("click", () => { closeCard(); beatIdx = i; goTo(s); lastInput = performance.now(); });
    dotsBox.appendChild(b);
  });
  const dotEls = [...dotsBox.children] as HTMLElement[];

  /* ---------- render ---------- */
  function easeOutCubic(t: number){ return 1 - Math.pow(1 - t, 3); }
  function fieldXY(p: Particle, t: number, pr: number){
    const wob = Math.sin(t * p.spd + p.ph);
    const a = p.a0 + wob * .06 + pr * .11 * p.depth;
    const r = p.r0n * R0 * (1 + wob * .035);
    const zoom = 1 + pr * .05 * p.depth;
    const eb = easeOutCubic(birth);
    return [ CX + Math.cos(a) * r * zoom * eb,
             CY + Math.sin(a) * r * .92 * zoom * eb - pr * 26 * p.depth ];
  }
  function render(t: number){
    ctx.clearRect(0, 0, W, H);
    if (birth <= 0) return;
    /* three-beat timeline: hero (0) -> the transformation (1) -> the question (2) */
    const haloK = smooth(prog, 1.42, 1.86);
    ctx.textAlign = "center"; ctx.textBaseline = "middle";

    /* whole-screen dimming while a beat's content is up (Randy 7/12): the field steps back, the stage speaks */
    const heroVis = birth * (1 - smooth(prog, .4, .95));
    const finVis = smooth(prog, 1.55, 1.9) * birth;
    const b2Vis = smooth(prog, .55, .95) * (1 - smooth(prog, 1.08, 1.45)) * birth;
    // Randy 7/16: the field steps back harder on beat 2 (was .84); the
    // word wall was competing with the transformation stage.
    /* handoff 021: on a 390px screen the field words are the same size as on
       desktop with a tenth of the room, so they sat directly behind the
       headline. Dim harder on phones only; desktop numbers are Randy's from
       7/16 and he has not re-reviewed desktop. */
    const titleDim = isPhone
      ? 1 - Math.max(.96 * heroVis, .94 * finVis, .97 * b2Vis)
      : 1 - Math.max(.88 * heroVis, .8 * finVis, .92 * b2Vis);

    for (const p of P){
      let [x, y] = fieldXY(p, t, prog);
      let alpha = birth * (p.depth === 1 ? .95 : p.depth === .6 ? .6 : .34);

      if (haloK > 0){
        const ha = p.a0;
        const hx = CX + Math.cos(ha) * Math.min(W, H) * (.36 + .1 * p.depth);
        const hy = CY + Math.sin(ha) * Math.min(W, H) * (.33 + .09 * p.depth);
        x = lerp(x, hx, haloK); y = lerp(y, hy, haloK);
        alpha = Math.max(alpha, birth * .5 * haloK);
      }
      alpha *= titleDim;

      if (p.type === "word"){
        if (p.swapPh <= 0 && mode === "universe" && t > p.swapAt){
          p.swapPh = .0001;
          p.swapAt = t + 6000 + Math.random() * 10000;
        }
        if (p.swapPh > 0){
          p.swapPh += .0125 * curDt;                          // slow, gentle crossfade (~1.3s)
          if (p.swapPh >= .5 && !p.swapped){ p.word = takeWord(p.word); p.swapped = true; }
          if (p.swapPh >= 1){ p.swapPh = 0; p.swapped = false; }
          alpha *= Math.abs(1 - p.swapPh * 2) * .75 + .25;
        }
        ctx.globalAlpha = alpha;
        ctx.font = p.fontStr;
        ctx.fillStyle = p.color;
        ctx.fillText(p.word, x, y);
      } else if (p.type === "dot"){
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(x, y, p.size, 0, Math.PI * 2); ctx.fill();
      } else if (p.type === "ring"){
        ctx.globalAlpha = alpha * .9;
        ctx.strokeStyle = p.color; ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.arc(x, y, p.size * 2.1, 0, Math.PI * 2); ctx.stroke();
      } else {
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(x, y); ctx.rotate(p.a0 + t * .00012 * (p.ph > 3 ? 1 : -1));
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size * 1.6, -p.size * .5, p.size * 3.2, p.size);
        ctx.restore();
      }
    }
  }

  /* ---------- DOM per frame ---------- */
  function updateDOM(){
    const heroOp = birth * (1 - smooth(prog, .4, .95));
    hero0.style.opacity = String(heroOp);
    hero0.style.transform = "translateY(" + (-26 * smooth(prog, 0, 1)) + "px)";

    const b2 = smooth(prog, .55, .95) * (1 - smooth(prog, 1.08, 1.45)) * birth;
    beat2.style.opacity = String(b2);
    beat2.style.transform = "scale(" + (0.97 + .03 * b2) + ")";
    stageTick(b2);

    const finOp = smooth(prog, 1.55, 1.9) * birth;
    finale.style.opacity = String(finOp);
    finale.style.transform = "scale(" + (0.97 + .03 * finOp) + ")";
    finale.classList.toggle("live", finOp > .6);

    let best = 0, bd = 1e9;
    SNAPS.forEach((sn, i) => { const d = Math.abs(prog - sn); if (d < bd){ bd = d; best = i; } });
    dotEls.forEach((d, i) => d.classList.toggle("on", i === best));
  }

  /* ---------- main loop ---------- */
  let lastT = 0, curDt = 1, rafId = 0;
  function loop(t: number){
    rafId = requestAnimationFrame(loop);
    if (mode === "landing"){ lastT = t; return; }
    const dt = clamp(t - lastT, 0, 100) / 16.7; lastT = t; curDt = dt;
    if (birthStart){
      const k = clamp((t - birthStart) / 950, 0, 1);
      birth = dying ? 1 - k : k;
      if (k >= 1) birthStart = 0;
      if (reduced) { birth = dying ? 0 : 1; birthStart = 0; }
    }
    if (tween){
      const k = clamp((t - tween.t0) / tween.dur, 0, 1);
      const e = k < .5 ? 4*k*k*k : 1 - Math.pow(-2*k + 2, 3) / 2;
      prog = lerp(tween.from, tween.to, e);
      if (k >= 1) tween = null;
    }
    render(t);
    updateDOM();
  }
  rafId = requestAnimationFrame(loop);

  /* debug handle (harmless in production) */
  Object.defineProperty(window, "__uni", { value: {
    get prog(){ return prog }, get target(){ return target }, get mode(){ return mode },
    go(v: number){ target = clamp(v, 0, MAX); lastInput = performance.now(); },
    enter(){ gate.click(); }, up(){ goUp(false); }
  }, configurable: true });

  /* ---------- input: one gesture = one beat, forced stop ---------- */
  let enteredAt = 0, beatIdx = 0, tween: { from: number; to: number; t0: number; dur: number } | null = null;
  const inGrace = () => performance.now() - enteredAt < 650;
  /* every beat travels on a fixed-duration cinematic tween: input can pick the destination,
     never the speed. luxury = the pace is ours, not the wheel's. */
  function goTo(v: number){
    tween = { from: prog, to: v, t0: performance.now(),
      dur: clamp(1500 * Math.abs(v - prog), 1000, 2000) };
    target = v;
  }
  function step(dir: number){
    lastInput = performance.now();
    if (dir < 0 && beatIdx === 0){ goUp(false); return; }
    beatIdx = clamp(beatIdx + dir, 0, SNAPS.length - 1);
    goTo(SNAPS[beatIdx]);
  }
  /* Randy 9/11: the circled arrow under beat 2's squares advances the beat,
     for anyone who does not realise the page scrolls. Uses the same step()
     the wheel and keys use, so it obeys the one-gesture-one-beat law. */
  const beat2Next = document.getElementById("sig-beat2-next");
  if (beat2Next) beat2Next.addEventListener("click", () => { closeCard(); step(1); });

  /* a wheel burst (incl. trackpad inertia) counts as ONE gesture; a distinct new burst = next beat */
  let lastWheelT = 0, burstSum = 0, burstStepped = false;
  on(world, "wheel", ((e: WheelEvent) => {
    e.preventDefault();
    if (mode !== "universe" || inGrace()) return;
    if (cardOpen) return;   /* handoff 020: an open card owns the gesture */
    const now = performance.now();
    if (now - lastWheelT > 280){ burstSum = 0; burstStepped = false; }
    lastWheelT = now;
    burstSum += e.deltaY;
    if (!burstStepped && Math.abs(burstSum) > 26){
      burstStepped = true;
      const dir = burstSum > 0 ? 1 : -1; burstSum = 0;
      step(dir);
    }
    /* Randy (7/15): strictly one beat per gesture. The old "leaning on the
       wheel" branch let strong trackpad inertia fire a second step and skip
       to the finale; a new burst now requires a real pause first. */
  }) as EventListener, { passive: false });

  let touchY: number | null = null, touchStepped = false;
  on(world, "touchstart", ((e: TouchEvent) => { touchY = e.touches[0].clientY; touchStepped = false; }) as EventListener, { passive: true });
  on(world, "touchmove", ((e: TouchEvent) => {
    if (mode !== "universe" || touchY === null || inGrace()) return;
    /* Before preventDefault, so the card sheet keeps its OWN scroll on a
       phone while the beat underneath stays put. */
    if (cardOpen) return;
    e.preventDefault();
    const dy = touchY - e.touches[0].clientY;
    if (!touchStepped && Math.abs(dy) > 46){
      touchStepped = true;
      step(dy > 0 ? 1 : -1);
    }
  }) as EventListener, { passive: false });

  on(window, "keydown", ((e: KeyboardEvent) => {
    if (mode !== "universe") return;
    if (e.key === "Escape"){ closeCard(); return; }
    if (cardOpen) return;   /* arrows must not step beats behind a card */
    if (e.key === "ArrowDown" || e.key === "PageDown" || e.key === " "){
      e.preventDefault(); step(1);
    } else if (e.key === "ArrowUp" || e.key === "PageUp"){
      e.preventDefault(); step(-1);
    }
  }) as EventListener);

  /* ---------- opening ritual (every load): the dot says SIGNAL, then the page grows out of it ---------- */
  const intro = $("sig-intro");
  if (reduced){
    document.body.classList.add("sig-introdone");
    intro.style.display = "none";
  } else {
    later(() => {
      intro.classList.add("bye");
      document.body.classList.add("sig-introdone");
    }, 1500);
    later(() => { intro.style.display = "none"; }, 2100);
  }

  /* ---------- entry ritual ---------- */
  let entered = false;
  function enter(){
    if (mode !== "landing") return;
    mode = "ritual"; entered = true;
    prog = 0; target = 0; beatIdx = 0; exitPull = 0; dying = false; birth = 0; tween = null;
    initParticles();
    if (reduced){
      landing.classList.add("collapsing");
      document.body.classList.add("sig-entered");
      birth = 1; mode = "universe"; enteredAt = performance.now();
      return;
    }
    landing.classList.add("collapsing");
    later(() => seed.classList.add("on"), 470);
    later(() => document.body.classList.add("sig-entered"), 560);
    later(() => {
      seed.classList.remove("on"); seed.classList.add("off");
      birthStart = performance.now(); dying = false;
      mode = "universe"; enteredAt = performance.now();
    }, 1160);
    later(() => seed.classList.remove("off"), 1800);
  }
  on(gate, "click", enter);

  /* ---------- exit: the entry ritual in reverse, full circle ---------- */
  function goUp(focusComposer: boolean){
    if (mode !== "universe") return;
    mode = "ritual-out";                                   // freeze the scene where it is: no rewind,
    dying = true; birthStart = performance.now();          // the universe just implodes back to the center
    if (!reduced){
      later(() => { seed.classList.remove("off"); seed.classList.add("on"); }, 620);   // the signal-dot reappears
      later(() => {
        seed.classList.remove("on"); seed.classList.add("off");
        document.body.classList.remove("sig-entered");
        landing.classList.remove("collapsing");            // the page grows back from the dot
      }, 1050);
    } else {
      later(() => { document.body.classList.remove("sig-entered"); landing.classList.remove("collapsing"); }, 10);
    }
    later(() => {
      mode = "landing"; entered = false; dying = false; birth = 0; prog = 0; target = 0; beatIdx = 0; tween = null;
      seed.classList.remove("off");
      if (focusComposer){
        const swrap = document.getElementById("sig-swrap");
        if (swrap && swrap.dataset.origin === "type" && swrap.classList.contains("open")){
          document.querySelector<HTMLTextAreaElement>(".sig-composer textarea")?.focus();
        }
      }
    }, reduced ? 60 : 1750);
  }
  on($("sig-upbtn"), "click", () => goUp(true));

  /* keep TS honest about reference vestiges (read in the reference's future revisions) */
  void exitPull; void lastInput; void entered;

  /* ---------- dispose (unmount) ---------- */
  return () => {
    cancelAnimationFrame(rafId);
    timeouts.forEach((id) => clearTimeout(id));
    offs.forEach((off) => off());
    document.body.classList.remove("sig-entered", "sig-introdone");
    delete (window as unknown as Record<string, unknown>).__uni;
  };
}

export default function SignalUniverse() {
  useEffect(() => {
    let disposed = false;
    let dispose: (() => void) | null = null;
    // canvas text must never draw a fallback font (handoff 002)
    document.fonts.ready.then(() => {
      if (disposed) return;
      dispose = boot();
    });
    return () => {
      disposed = true;
      if (dispose) dispose();
    };
  }, []);

  return (
    <>
      <div className="sig-world" id="sig-world">
        <canvas id="sig-field" />
        <div className="beat hero0" id="sig-hero0">
          <div className="plate">
            <h1>
              <span className="h0a">Your business on one side.</span>{" "}
              <span className="h0b">AI on the other.</span>
              <br />
              <em>We&rsquo;re the bridge.</em>
            </h1>
          </div>
          {/* Randy 9/11: the hairline became an arrow, so people who do not
              know to scroll can see which way to go. Thick, and it inherits
              the taupe of the word above it. */}
          <div className="scrollcue">
            Scroll
            <svg className="cuearrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 5v13M6 13l6 6 6-6" />
            </svg>
          </div>
        </div>
        <div className="beat beat2" id="sig-beat2">
          <div className="plate">
            {/* h2, not h1: one H1 per page (audit 001). hero0 above is THE
                headline; this is the second beat. Styled by element selector
                in globals.css, so the selectors there name both levels. */}
            {/* Randy 9/11: the promise now says who it is for. "anyone" takes
                the same accent as "custom". Deliberately still TWO lines: a
                third would push an open card's closing line past the bottom
                at 1280x720, where it currently clears by 12px. */}
            <h2>
              We create <em>custom</em> AI tools
              <br />
              for your business that <em>anyone</em> can use.
            </h2>
            {/* Randy 7/16: the subtitle drives the point; the old
                "just a few examples" line below the stage is gone. */}
            <p className="bsub">
              Think of the job your business hates most. We build the tool that does it for you.
            </p>
          </div>

          {/* The waterfall (handoff 020): fifteen pairs drifting up, ~10 visible,
              so a visitor catches the one that is theirs. The list is rendered
              TWICE and translated -50% over 58s, which is what makes the loop
              seamless; the second copy is aria-hidden so a screen reader reads
              the fifteen once. */}
          <div className="fhead" aria-hidden="true">
            <span className="l">The problem</span>
            <span />
            <span className="r">The tool</span>
          </div>
          <div className="fall" id="sig-fall" aria-label="Problems Signal has turned into tools">
            <ul>
              {[0, 1].map((copy) =>
                PAIRS.map(([problem, tool], i) => (
                  <li key={`${copy}-${i}`} aria-hidden={copy === 1 ? true : undefined}>
                    <span className={"p" + (i === TWO_LINE_ROW ? " two" : "")}>{problem}</span>
                    <svg className="arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M4 12h15M13 6l6 6-6 6" />
                    </svg>
                    <span className="s">{tool}</span>
                  </li>
                )),
              )}
            </ul>
          </div>

          {/* The three squares and their cards. */}
          <div className="cases" id="sig-cases">
            <p className="kick">A few examples of what we build</p>
            <div className="grid">
              {CASES.map((c) => (
                <button
                  key={c.key}
                  className="sq"
                  type="button"
                  data-case={c.key}
                  aria-expanded="false"
                  aria-controls={`sig-panel-${c.key}`}
                >
                  <div className="name">{c.name}<i>.</i></div>
                  <div className="open">See it</div>
                </button>
              ))}
            </div>
            {CASES.map((c) => (
              <div className="panel" key={c.key} id={`sig-panel-${c.key}`} data-case={c.key}>
                <button className="x" type="button" aria-label="Close">&times;</button>
                <div className="who">{c.who}</div>
                <div className="name">{c.name}<i>.</i></div>
                <div className="rows">
                  {c.rows.map(([heading, body]) => (
                    <div key={heading}>
                      <h4>{heading}</h4>
                      <p>{body}</p>
                    </div>
                  ))}
                </div>
                <div className="line">{c.line[0]}<b>{c.line[1]}</b></div>
              </div>
            ))}
          </div>
          {/* Randy 9/11: a click target for anyone who does not realise the
              beats scroll. Hidden while a card is open, both because you are
              reading rather than moving on and because its height is what
              keeps the card inside the viewport at 1280x720. */}
          <button className="beatnext" type="button" id="sig-beat2-next" aria-label="Next">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 5v13M6 13l6 6 6-6" />
            </svg>
          </button>
        </div>
        <div className="beat finale" id="sig-finale">
          <div className="plate">
            {/* Randy 7/16: beat 2's subtitle now carries "tell us what your
                business needs," so the finale asks the action question. */}
            <h2>
              So, what should we <em>build</em> for you?
            </h2>
            <button className="upbtn" id="sig-upbtn" type="button">
              Let&rsquo;s find out
            </button>
          </div>
        </div>
      </div>

      <div className="sig-dots" id="sig-dots" />
    </>
  );
}
