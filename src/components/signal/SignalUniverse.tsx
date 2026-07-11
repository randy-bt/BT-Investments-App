"use client";

import { useEffect } from "react";

// SIGNAL UNIVERSE (handoff 002): the second half of /signal.
//
// This is a PORT of the <script> engine in
// SIGNAL/design/signal-universe.html, kept nearly verbatim on purpose:
// same function names, same constants, same structure, so that when
// Geoffrey ships an updated reference the diff maps 1:1 onto this file.
// Do not "improve" the tuned values (see the handoff's laws).
//
// Differences from the reference, all mechanical:
// - element ids carry a sig- prefix; body classes are sig-entered /
//   sig-introdone (the body is shared with the rest of the app)
// - canvas font strings resolve --sig-display (next/font Comfortaa)
//   instead of the reference's base64 @font-face; the engine boots after
//   document.fonts.ready so canvas text never draws a fallback
// - the exit button focuses 001's real composer textarea
// - listeners/timeouts/rAF are tracked and disposed on unmount
//   (the reference is a single page that never unmounts)

export const PAL = ["#ff2d55", "#ffb300", "#00c46a", "#0090ff", "#c084fc", "#ff6a00", "#00b8c4", "#a3e635", "#f472b6", "#5856d6"];
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
  // runtime fields (wall / fisheye / swaps)
  inWall?: boolean;
  _w?: number;
  formX?: number;
  formY?: number;
  formRow?: number;
  wallSwapAt?: number;
  swapped?: boolean;
  fitSwap?: boolean;
  mkS?: number;
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

  /* ---------- beat system: hero -> the tool wall -> the question ---------- */
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

  /* pre-rendered glow sprites: all the light, none of the shadowBlur cost */
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

  /* ---------- the tool wall (beat 2): the chaos organizes into readable rows ---------- */
  let wallReady = false, lastFormK = 0, lastWallSwap = 0, wallGapNext = 1600;
  let mx = -9999, my = -9999;   // mouse, for the wall fisheye
  const WIDTHS = new Map<string, number>();
  function wordW(w: string){
    if (!WIDTHS.has(w)){ ctx.font = '700 14px ' + DISP; WIDTHS.set(w, ctx.measureText(w).width); }
    return WIDTHS.get(w)!;
  }
  function fitsAvailable(p: Particle){
    const maxw = p._w! - 34;
    for (let i = freeWords.length - 1; i >= 0; i--) if (wordW(freeWords[i]) <= maxw) return true;
    return false;
  }
  function takeFitting(p: Particle){
    const maxw = p._w! - 34;
    for (let i = freeWords.length - 1; i >= 0; i--){
      if (wordW(freeWords[i]) <= maxw){
        const w = freeWords[i]; freeWords.splice(i, 1); freeWords.unshift(p.word);
        return w;
      }
    }
    return p.word;   // nothing narrower available: keep this one
  }
  function layoutWall(){
    const now = performance.now();
    const wordsP = P.filter(p => p.type === "word");
    wordsP.forEach(p => p.inWall = false);
    const small = Math.min(W, H) < 640;
    const maxW = Math.min(W * .82, 1000), lh = small ? 30 : 37;
    /* the wall starts strictly below the headline, never overlapping it */
    const pr = beat2.querySelector(".plate")!.getBoundingClientRect();
    const wallTop = pr.bottom + 36;
    const maxRows = Math.max(3, Math.floor((H - wallTop - 56) / lh));
    const rows: Array<{ line: Particle[]; w: number }> = []; let line: Particle[] = [], x = 0;
    for (const p of wordsP){
      const w = wordW(p.word) + 34;
      if (x + w > maxW && line.length){
        rows.push({ line, w: x }); line = []; x = 0;
        if (rows.length >= maxRows) break;
      }
      p._w = w; line.push(p); x += w;
    }
    if (line.length && rows.length < maxRows) rows.push({ line, w: x });
    rows.forEach((r, ri) => {
      let cx0 = CX - r.w / 2;
      r.line.forEach(p => {
        p.inWall = true;
        p.formX = cx0 + p._w! / 2 - 17;
        p.formY = wallTop + ri * lh + lh / 2;
        p.formRow = ri;
        p.wallSwapAt = now + 5000 + Math.random() * 26000;
        cx0 += p._w!;
      });
    });
    wallReady = true;
  }

  /* ---------- progress dots ---------- */
  dotsBox.textContent = "";
  SNAPS.forEach((s, i) => {
    const b = document.createElement("button");
    b.setAttribute("aria-label", "Go to scene " + (i + 1));
    b.addEventListener("click", () => { beatIdx = i; goTo(s); lastInput = performance.now(); });
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
    /* three-beat timeline: hero (0) -> tool wall (1) -> the question (2) */
    const formK = smooth(prog, .5, .98) * (1 - smooth(prog, 1.06, 1.52));
    const haloK = smooth(prog, 1.42, 1.86);
    if (formK > 0 && lastFormK <= 0) layoutWall();
    lastFormK = formK;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";

    /* whole-screen darkening while the first or last title is up (Randy 7/12) */
    const heroVis = birth * (1 - smooth(prog, .4, .95));
    const finVis = smooth(prog, 1.55, 1.9) * birth;
    const titleDim = 1 - Math.max(.88 * heroVis, .8 * finVis);

    for (const p of P){
      let [x, y] = fieldXY(p, t, prog);
      let alpha = birth * (p.depth === 1 ? .95 : p.depth === .6 ? .6 : .34);

      /* beat 2: wall words organize into rows; everything else steps back */
      let ef = 0, hs = 1;
      if (formK > 0 && wallReady){
        if (p.type === "word" && p.inWall){
          /* 1.6 headroom guarantees every row fully lands in its slot, even the last one */
          ef = smooth(clamp(formK * 1.6 - p.formRow! * .05, 0, 1), 0, 1);
          x = lerp(x, p.formX!, ef);
          y = lerp(y, p.formY! + Math.sin(t * .0012 + p.formRow!) * 3, ef);
          alpha = lerp(alpha, .97, ef);
          /* fisheye: tight radius, strong peak, liquid-eased response */
          let mk = 0;
          if (ef > .5 && mx > -999){
            const md = Math.hypot(x - mx, y - my);
            mk = smooth(md, 70, 16) * ef;
          }
          p.mkS = (p.mkS || 0) + (mk - (p.mkS || 0)) * (1 - Math.pow(.82, curDt));
          if (p.mkS > .003){
            hs = 1 + .34 * p.mkS;
            x += (x - mx) * .13 * p.mkS;
            y += (y - my) * .08 * p.mkS;
            alpha = Math.min(1, alpha + .22 * p.mkS);
          }
        } else if (p.type === "word"){
          alpha *= (1 - formK);          // words that missed the wall leave the stage entirely
        } else {
          alpha *= (1 - .55 * formK);    // shapes stay, dimmed
        }
      }
      if (haloK > 0){
        const ha = p.a0;
        const hx = CX + Math.cos(ha) * Math.min(W, H) * (.36 + .1 * p.depth);
        const hy = CY + Math.sin(ha) * Math.min(W, H) * (.33 + .09 * p.depth);
        x = lerp(x, hx, haloK); y = lerp(y, hy, haloK);
        alpha = Math.max(alpha, birth * .5 * haloK);
      }
      alpha *= titleDim;

      if (p.type === "word"){
        if (p.swapPh <= 0 && mode === "universe"){
          if (formK > 0 && ef > .9 && p.inWall && t > p.wallSwapAt! && t - lastWallSwap > wallGapNext){
            p.wallSwapAt = t + 14000 + Math.random() * 18000;  // each wall word: every ~14 to 32s
            if (fitsAvailable(p)){
              p.swapPh = .0001; p.fitSwap = true; lastWallSwap = t;
              wallGapNext = 900 + Math.random() * 2800;        // uneven rhythm: sometimes close, sometimes a lull
            }
          } else if (formK <= 0 && t > p.swapAt){
            p.swapPh = .0001; p.fitSwap = false;
            p.swapAt = t + 6000 + Math.random() * 10000;
          }
        }
        if (p.swapPh > 0){
          p.swapPh += .0125 * curDt;                          // slow, gentle crossfade (~1.3s)
          if (p.swapPh >= .5 && !p.swapped){ p.word = p.fitSwap ? takeFitting(p) : takeWord(p.word); p.swapped = true; }
          if (p.swapPh >= 1){ p.swapPh = 0; p.swapped = false; }
          alpha *= Math.abs(1 - p.swapPh * 2) * .75 + .25;
        }
        ctx.globalAlpha = alpha;
        ctx.font = ef > 0 ? '700 ' + (lerp(p.size, 14, ef) * hs).toFixed(1) + 'px ' + DISP : p.fontStr;
        ctx.fillStyle = p.color;
        ctx.fillText(p.word, x, y);
      } else if (p.type === "dot"){
        const r = p.size;
        if (p.depth === 1){
          ctx.globalAlpha = alpha * .85;
          ctx.drawImage(glowSprite(p.color), x - r * 3.4, y - r * 3.4, r * 6.8, r * 6.8);
        }
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
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
  /* a wheel burst (incl. trackpad inertia) counts as ONE gesture; a distinct new burst = next beat */
  let lastWheelT = 0, burstSum = 0, burstStepped = false, lastStepT = 0;
  on(world, "wheel", ((e: WheelEvent) => {
    e.preventDefault();
    if (mode !== "universe" || inGrace()) return;
    const now = performance.now();
    if (now - lastWheelT > 280){ burstSum = 0; burstStepped = false; }
    lastWheelT = now;
    burstSum += e.deltaY;
    if (!burstStepped && Math.abs(burstSum) > 26){
      burstStepped = true; lastStepT = now;
      const dir = burstSum > 0 ? 1 : -1; burstSum = 0;
      step(dir);
    } else if (burstStepped && Math.abs(burstSum) > 420 && now - lastStepT > 800){
      /* someone leaning on the wheel keeps moving: about one beat per second, never ignored */
      lastStepT = now;
      const dir = burstSum > 0 ? 1 : -1; burstSum = 0;
      step(dir);
    }
  }) as EventListener, { passive: false });

  on(world, "mousemove", ((e: MouseEvent) => { mx = e.clientX; my = e.clientY; }) as EventListener, { passive: true });
  on(world, "mouseleave", () => { mx = my = -9999; });

  let touchY: number | null = null, touchStepped = false;
  on(world, "touchstart", ((e: TouchEvent) => { touchY = e.touches[0].clientY; touchStepped = false; }) as EventListener, { passive: true });
  on(world, "touchmove", ((e: TouchEvent) => {
    if (mode !== "universe" || touchY === null || inGrace()) return;
    e.preventDefault();
    const dy = touchY - e.touches[0].clientY;
    if (!touchStepped && Math.abs(dy) > 46){
      touchStepped = true;
      step(dy > 0 ? 1 : -1);
    }
  }) as EventListener, { passive: false });

  on(window, "keydown", ((e: KeyboardEvent) => {
    if (mode !== "universe") return;
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
      if (focusComposer){ const t = document.querySelector<HTMLTextAreaElement>(".sig-composer textarea"); if (t) t.focus(); }
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
              Your business on one side. AI on the other.
              <br />
              <em>We&rsquo;re the bridge.</em>
            </h1>
          </div>
          <div className="scrollcue">Scroll</div>
        </div>
        <div className="beat beat2" id="sig-beat2">
          <div className="plate">
            <h1>
              We create <em>custom</em> AI tools
              <br />
              for your business.
            </h1>
            <div className="wsub2">Just a few examples. The list never ends.</div>
          </div>
        </div>
        <div className="beat finale" id="sig-finale">
          <div className="plate">
            <h2>
              So, what does <em>your business</em> need?
            </h2>
            <button className="upbtn" id="sig-upbtn" type="button">
              Tell us what you need
            </button>
          </div>
        </div>
      </div>

      <div className="sig-dots" id="sig-dots" />
    </>
  );
}
