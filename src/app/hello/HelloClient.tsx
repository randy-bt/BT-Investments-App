"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  motion,
  AnimatePresence,
  useMotionValue,
  useSpring,
  useTransform,
} from "framer-motion";
import { HelloSellForm } from "./HelloSellForm";
import { HelloBuyersForm } from "./HelloBuyersForm";

// Cards bumped 15% larger; TARGET dims scaled to match so the
// fit-scale logic still shrinks the layout correctly on smaller
// viewports.
const TARGET_WIDTH = 884 * 1.15 * 0.78;
const TARGET_HEIGHT = 520 * 1.15 * 0.78;
const HORIZONTAL_PADDING = 32;
const VERTICAL_ALLOWANCE = 56;

function useFitScale() {
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const compute = () =>
      Math.min(
        1,
        (window.innerWidth - HORIZONTAL_PADDING) / TARGET_WIDTH,
        (window.innerHeight - HORIZONTAL_PADDING - VERTICAL_ALLOWANCE) /
          TARGET_HEIGHT,
      );
    const handler = () => setScale(compute());
    handler();
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  return scale;
}

type Screen =
  | "cards"
  | "buyers"
  | "form"
  | "sellForm"
  | "infiniteMedia"
  | "signalWaitlist";

type InfiniteTab = "services" | "portfolio" | "contact";

/**
 * Map a Hello screen to its URL. We push to real routes that exist as
 * standalone pages so they're shareable / QR-able. The form screens
 * (`form` / `sellForm`) deliberately stay on /hello because /sell-property
 * and /join-buyers-list are different (marketing-styled) experiences,
 * and pushing to those URLs from inside Hello would cause Next to swap
 * in the marketing forms on refresh / HMR.
 */
function urlForState(screen: Screen, tab: InfiniteTab): string {
  switch (screen) {
    case "signalWaitlist":
      return "/signal";
    case "infiniteMedia":
      return tab === "portfolio" ? "/infinite-media/portfolio" : "/infinite-media";
    default:
      return "/hello";
  }
}

function stateFromUrl(pathname: string): { screen: Screen; tab: InfiniteTab } {
  if (pathname.startsWith("/signal")) {
    return { screen: "signalWaitlist", tab: "services" };
  }
  if (pathname.startsWith("/infinite-media/portfolio")) {
    return { screen: "infiniteMedia", tab: "portfolio" };
  }
  if (pathname.startsWith("/infinite-media")) {
    return { screen: "infiniteMedia", tab: "services" };
  }
  return { screen: "cards", tab: "services" };
}

const SERVICES = [
  "Photography",
  "Videography",
  "Social Media Content",
  "Podcast Production",
  "Event Coverage",
  "Web Design",
  "Branding",
  "Graphic Design",
  "Drone Footage",
  "Content Strategy",
  "Media Consulting",
];

const NOISE_BG = `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`;

const NOISE_BG_DENSE = `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`;

type HelloClientProps = {
  initialScreen?: Screen;
  initialInfiniteTab?: InfiniteTab;
  /**
   * When true, back-arrow buttons in the form views use browser history
   * (router.back()) instead of switching to an internal screen. Set this
   * when rendering HelloClient outside the /hello flow — e.g., from
   * /sell-property or /join-buyers-list reached via the marketing site —
   * so "back" returns the user to the page they came from rather than
   * dumping them onto /hello.
   */
  standalone?: boolean;
};

export default function HelloClient({
  initialScreen = "cards",
  initialInfiniteTab = "services",
  standalone = false,
}: HelloClientProps = {}) {
  const router = useRouter();
  const [screen, setScreen] = useState<Screen>(initialScreen);
  const [infiniteTab, setInfiniteTab] = useState<InfiniteTab>(initialInfiniteTab);
  const [waitlistEmail, setWaitlistEmail] = useState("");
  const [waitlistSubmitted, setWaitlistSubmitted] = useState(false);
  const [waitlistSubmitting, setWaitlistSubmitting] = useState(false);
  const [waitlistError, setWaitlistError] = useState<string | null>(null);

  useEffect(() => {
    const desired = urlForState(screen, infiniteTab);
    if (window.location.pathname !== desired) {
      window.history.pushState(null, "", desired);
    }
  }, [screen, infiniteTab]);

  useEffect(() => {
    function handlePop() {
      const next = stateFromUrl(window.location.pathname);
      setScreen(next.screen);
      setInfiniteTab(next.tab);
    }
    window.addEventListener("popstate", handlePop);
    return () => window.removeEventListener("popstate", handlePop);
  }, []);

  const fit = useFitScale();
  const containerRef = useRef<HTMLDivElement>(null);

  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);
  const mx = useSpring(rawX, { stiffness: 120, damping: 20, mass: 0.6 });
  const my = useSpring(rawY, { stiffness: 120, damping: 20, mass: 0.6 });

  const rotateX = useTransform(my, [-1, 1], [8, -8]);
  const rotateY = useTransform(mx, [-1, 1], [-8, 8]);

  const leftX = useTransform(mx, [-1, 1], [-15, 15]);
  const leftY = useTransform(my, [-1, 1], [-15, 15]);
  const rightX = useTransform(mx, [-1, 1], [15, -15]);
  const rightY = useTransform(my, [-1, 1], [15, -15]);

  const leftInnerX = useTransform(leftX, (v) => -v);
  const leftInnerY = useTransform(leftY, (v) => -v);
  const rightInnerX = useTransform(rightX, (v) => -v);
  const rightInnerY = useTransform(rightY, (v) => -v);

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    rawX.set(x * 2 - 1);
    rawY.set(y * 2 - 1);
  }

  function handleMouseLeave() {
    rawX.set(0);
    rawY.set(0);
  }

  function closeWaitlist() {
    setScreen("cards");
    setWaitlistEmail("");
    setWaitlistSubmitted(false);
    setWaitlistSubmitting(false);
    setWaitlistError(null);
  }

  // Save the waitlist signup to Supabase + trigger the notification
  // email (via /api/forms/submit, the same endpoint used by all the
  // marketing forms). Uses form_name "Signal - Waitlist" so it shows
  // up clearly in the inbox.
  async function handleWaitlistSubmit() {
    if (waitlistSubmitting || !waitlistEmail.trim()) return;
    setWaitlistSubmitting(true);
    setWaitlistError(null);
    try {
      const res = await fetch("/api/forms/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          form_name: "Signal - Waitlist",
          data: { Email: waitlistEmail.trim() },
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setWaitlistError(body?.error ?? "Submission failed. Please try again.");
        setWaitlistSubmitting(false);
        return;
      }
      setWaitlistSubmitted(true);
    } catch {
      setWaitlistError("Submission failed. Please check your connection.");
    } finally {
      setWaitlistSubmitting(false);
    }
  }

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="h-screen h-[100dvh] w-full flex flex-col items-center justify-center overflow-hidden bg-[#e9e6dd] relative"
      style={{ perspective: "1200px" }}
    >
      {/* Grain overlay */}
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none mix-blend-multiply"
        style={{ backgroundImage: NOISE_BG }}
        aria-hidden
      />

      <div className="flex-1 min-h-0 w-full flex flex-col items-center justify-center z-10">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
          className="w-full flex justify-center"
        >
          <AnimatePresence mode="wait">
            {screen === "cards" && (
              <CardsOverview
                key="cards"
                fit={fit}
                rotateX={rotateX}
                rotateY={rotateY}
                leftX={leftX}
                leftY={leftY}
                rightX={rightX}
                rightY={rightY}
                leftInnerX={leftInnerX}
                leftInnerY={leftInnerY}
                rightInnerX={rightInnerX}
                rightInnerY={rightInnerY}
                onBT={() => setScreen("buyers")}
                onSignal={() => setScreen("signalWaitlist")}
                onInfiniteMedia={() => setScreen("infiniteMedia")}
                onInfiniteRe={() => router.push("/infinite-re")}
              />
            )}

            {screen === "buyers" && (
              <BuyersCards
                key="buyers"
                fit={fit}
                rotateX={rotateX}
                rotateY={rotateY}
                leftX={leftX}
                leftY={leftY}
                rightX={rightX}
                rightY={rightY}
                leftInnerX={leftInnerX}
                leftInnerY={leftInnerY}
                rightInnerX={rightInnerX}
                rightInnerY={rightInnerY}
                onBuyersList={() => setScreen("form")}
                onSellProperty={() => setScreen("sellForm")}
                onBack={() => setScreen("cards")}
              />
            )}

            {screen === "form" && (
              <HelloBuyersForm
                key="form"
                fit={fit}
                onBack={
                  standalone ? () => router.back() : () => setScreen("buyers")
                }
              />
            )}

            {screen === "sellForm" && (
              <HelloSellForm
                key="sellForm"
                fit={fit}
                onBack={
                  standalone ? () => router.back() : () => setScreen("buyers")
                }
              />
            )}

            {screen === "infiniteMedia" && (
              <InfiniteMediaView
                key="infiniteMedia"
                activeTab={infiniteTab}
                onTabChange={setInfiniteTab}
                onClose={
                  standalone
                    ? () => router.push("/hello")
                    : () => setScreen("cards")
                }
              />
            )}

            {screen === "signalWaitlist" && (
              <SignalWaitlist
                key="signalWaitlist"
                email={waitlistEmail}
                onEmailChange={setWaitlistEmail}
                submitted={waitlistSubmitted}
                submitting={waitlistSubmitting}
                error={waitlistError}
                onSubmit={handleWaitlistSubmit}
                onClose={
                  standalone ? () => router.push("/hello") : closeWaitlist
                }
              />
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      <motion.div
        className="flex-shrink-0 pt-4 pb-3 text-center w-full"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1, duration: 1 }}
      >
        <p className="font-sans text-[10.4px] tracking-widest text-[#888] uppercase">
          Powered by BT Investments
        </p>
      </motion.div>
    </div>
  );
}

type Tv = ReturnType<typeof useTransform<number, number>>;

type ParallaxProps = {
  fit: number;
  rotateX: Tv;
  rotateY: Tv;
  leftX: Tv;
  leftY: Tv;
  rightX: Tv;
  rightY: Tv;
  leftInnerX: Tv;
  leftInnerY: Tv;
  rightInnerX: Tv;
  rightInnerY: Tv;
};

function CardsOverview(
  props: ParallaxProps & {
    onBT: () => void;
    onSignal: () => void;
    onInfiniteMedia: () => void;
    onInfiniteRe: () => void;
  },
) {
  const {
    fit,
    rotateX,
    rotateY,
    leftX,
    leftY,
    rightX,
    rightY,
    leftInnerX,
    leftInnerY,
    rightInnerX,
    rightInnerY,
    onBT,
    onSignal,
    onInfiniteMedia,
    onInfiniteRe,
  } = props;

  return (
    <motion.div
      className="flex flex-col items-center gap-6 origin-center"
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ y: [-5, 5, -5], opacity: 1, scale: 0.78 * fit }}
      transition={{
        opacity: { duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] },
        scale: { duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] },
        y: { duration: 8, repeat: Infinity, ease: "easeInOut" },
      }}
      exit={{
        opacity: 0,
        scale: 0.96,
        transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] },
      }}
    >
      <motion.div
        className="flex flex-row items-center justify-center gap-4 origin-center"
        style={{ rotateX, rotateY }}
      >
        {/* BT Investments card */}
        <motion.div
          className="relative w-[345px] h-[598px] rounded-[32px] overflow-hidden group shadow-[0_20px_50px_rgba(0,0,0,0.08)] bg-[#e0ddd1] cursor-pointer"
          style={{ x: leftX, y: leftY }}
          whileHover={{ scale: 1.05, transition: { duration: 0.4, ease: "easeOut" } }}
          onClick={onBT}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === "Enter" && onBT()}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/hello/bt-investments-card.jpg"
            alt="Residential house in a Seattle neighborhood, Craftsman-style with front porch"
            className="absolute inset-0 w-full h-full object-cover object-center"
            loading="eager"
            fetchPriority="high"
          />
          <div
            className="absolute inset-0 pointer-events-none rounded-[32px]"
            style={{
              background:
                "radial-gradient(ellipse 140% 120% at 0% 100%, rgba(224, 221, 209, 0.92) 0%, rgba(224, 221, 209, 0.5) 35%, transparent 70%)",
            }}
            aria-hidden
          />
          <motion.div
            className="absolute bottom-0 left-0 right-0 flex flex-col justify-end p-8 pb-8 z-10"
            style={{ x: leftInnerX, y: leftInnerY }}
          >
            {/* Match the marketing-site logo treatment: Cormorant
                serif "BT" with the olive uppercase + tracked-out
                "Investments" eyebrow underneath. */}
            <h2
              style={{
                fontFamily: "var(--font-cormorant), Georgia, serif",
                color: "#1a1a17",
                fontSize: "78px",
                fontWeight: 600,
                lineHeight: 1,
                letterSpacing: "-0.02em",
                marginBottom: "-0.14em",
              }}
            >
              BT
            </h2>
            <div
              style={{
                fontFamily: "var(--font-inter), system-ui, sans-serif",
                textTransform: "uppercase",
                letterSpacing: "0.5em",
                color: "#76794c",
                fontSize: "15px",
                fontWeight: 500,
                marginTop: "6px",
              }}
            >
              Investments
            </div>
          </motion.div>
        </motion.div>

        {/* Signal card */}
        <motion.div
          className="relative w-[345px] h-[598px] rounded-[32px] overflow-hidden bg-[#f4f2ef] shadow-[0_25px_60px_rgba(0,0,0,0.06)] flex flex-col items-center justify-center group cursor-pointer"
          whileHover={{ scale: 1.05, transition: { duration: 0.4, ease: "easeOut" } }}
          onClick={onSignal}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === "Enter" && onSignal()}
        >
          <div
            className="absolute inset-0 opacity-[0.3] pointer-events-none mix-blend-overlay"
            style={{ backgroundImage: NOISE_BG_DENSE }}
            aria-hidden
          />
          <div
            className="absolute inset-0 pointer-events-none rounded-[32px] overflow-hidden z-[1]"
            aria-hidden
          >
            <div
              className="absolute inset-y-0 w-[50%] -left-[25%] rounded-[32px]"
              style={{
                background:
                  "linear-gradient(105deg, transparent 0%, transparent 35%, rgba(255,255,255,0.35) 50%, transparent 65%, transparent 100%)",
                animation: "signal-shine 10s ease-in-out infinite",
              }}
            />
          </div>
          <div className="text-center z-10 relative mt-6">
            <motion.h1
              className="font-serif text-[74px] text-[#161616] leading-[0.9] tracking-[-0.03em] font-semibold"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.8 }}
            >
              Signal
            </motion.h1>
            <motion.p
              className="font-sans text-[14px] text-[#444] mt-3 font-normal tracking-wide"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.8 }}
            >
              An AI Company for your business
            </motion.p>
          </div>
          <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/40 to-white/0 opacity-0 group-hover:opacity-100 transition-opacity duration-1000 rounded-[32px] pointer-events-none" />
        </motion.div>

        {/* Right column: Infinite Media + Infinite RE */}
        <motion.div
          className="flex flex-col gap-4"
          style={{ x: rightX, y: rightY }}
        >
          {/* Infinite Media */}
          <motion.div
            className="relative w-[291px] h-[291px] rounded-[32px] overflow-hidden shadow-[0_15px_40px_rgba(0,0,0,0.05)] group cursor-pointer"
            whileHover={{ scale: 1.05, transition: { duration: 0.4, ease: "easeOut" } }}
            onClick={onInfiniteMedia}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === "Enter" && onInfiniteMedia()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/hello/infinite-media-card.jpg"
              alt="Infinite Media"
              className="absolute inset-0 w-full h-full object-cover"
            />
            <div
              className="absolute inset-0 rounded-[32px] pointer-events-none mix-blend-overlay"
              style={{ background: "rgba(248, 250, 255, 0.06)" }}
              aria-hidden
            />
            <motion.div
              className="absolute bottom-0 left-0 right-0 p-5 pb-5 z-10 translate-y-[3px]"
              style={{ x: rightInnerX, y: rightInnerY }}
            >
              <h2 className="font-serif text-[30px] leading-[1.1] text-[#222] font-semibold tracking-tight">
                Infinite
                <br />
                Media
              </h2>
              <p className="font-sans text-[15px] text-[#5c5953] mt-1 font-medium tracking-tight">
                Photo, Video, Web Design, and more
              </p>
            </motion.div>
          </motion.div>

          {/* Infinite RE — landing isn't built out yet; clicking
              routes to /infinite-re, the standalone "coming soon"
              placeholder so the URL is at least live. */}
          <motion.div
            className="relative w-[291px] h-[291px] rounded-[32px] overflow-hidden group shadow-[0_15px_40px_rgba(0,0,0,0.06)] cursor-pointer"
            whileHover={{ scale: 1.05, transition: { duration: 0.4, ease: "easeOut" } }}
            onClick={onInfiniteRe}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === "Enter" && onInfiniteRe()}
          >
            <div
              className="absolute inset-0"
              style={{ filter: "brightness(1.08) saturate(0.92)" }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/hello/infinite-re-card.jpg"
                alt="Infinite RE"
                className="w-full h-full object-cover"
              />
            </div>
            <div
              className="absolute inset-0 rounded-[32px] pointer-events-none mix-blend-overlay"
              style={{ background: "rgba(238, 244, 255, 0.11)" }}
              aria-hidden
            />
            <motion.div
              className="absolute bottom-0 left-0 right-0 px-6 pb-5 z-10"
              style={{ x: rightInnerX, y: rightInnerY }}
            >
              <h2 className="font-serif text-[33px] text-[#222] font-semibold tracking-tight flex items-baseline gap-[3px]">
                Infinite
                <span className="text-[28px] text-[#b49a5c] italic font-medium">
                  RE
                </span>
              </h2>
            </motion.div>
          </motion.div>
        </motion.div>
      </motion.div>

      <p className="font-sans text-[48px] text-[#666] tracking-wide mt-8">
        How can we help?
      </p>
    </motion.div>
  );
}

function BuyersCards(
  props: ParallaxProps & {
    onBuyersList: () => void;
    onSellProperty: () => void;
    onBack: () => void;
  },
) {
  const {
    fit,
    rotateX,
    rotateY,
    leftX,
    leftY,
    rightX,
    rightY,
    leftInnerX,
    leftInnerY,
    rightInnerX,
    rightInnerY,
    onBuyersList,
    onSellProperty,
    onBack,
  } = props;

  return (
    <motion.div
      className="flex flex-row items-center justify-center gap-4 origin-center relative"
      style={{ rotateX, rotateY }}
      initial={{ opacity: 0, scale: 0.74 * fit }}
      animate={{ opacity: 1, y: [-5, 5, -5], scale: 0.78 * fit }}
      exit={{
        opacity: 0,
        scale: 0.96,
        transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] },
      }}
      transition={{
        opacity: { duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] },
        scale: { duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] },
        y: { duration: 8, repeat: Infinity, ease: "easeInOut" },
      }}
    >
      <motion.div
        className="flex flex-col items-center relative"
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{
          opacity: 0,
          scale: 0.96,
          transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] },
        }}
        transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
      >
        <div className="flex flex-row items-center justify-center gap-4">
          {/* Join our buyers list */}
          <motion.div
            className="relative w-[434px] h-[520px] rounded-[32px] overflow-hidden shadow-[0_4px_12px_rgba(0,0,0,0.02)] flex flex-col items-start justify-start cursor-pointer bg-[#6d8048] pt-10"
            style={{ x: leftX, y: leftY }}
            whileHover={{ scale: 1.02, transition: { duration: 0.3 } }}
            onClick={onBuyersList}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === "Enter" && onBuyersList()}
          >
            <motion.div
              className="relative z-10 w-full pl-8 pr-8"
              style={{ x: leftInnerX, y: leftInnerY }}
            >
              <p
                className="text-[66px] text-[#161616] tracking-tight text-left leading-[1.0]"
                style={{
                  fontFamily:
                    "var(--font-dm-serif-display), Georgia, serif",
                  fontWeight: 400,
                }}
              >
                Join our buyers list
              </p>
            </motion.div>
          </motion.div>

          {/* Sell your property */}
          <motion.div
            className="relative w-[434px] h-[520px] rounded-[32px] overflow-hidden shadow-[0_4px_12px_rgba(0,0,0,0.02)] flex flex-col items-start justify-start cursor-pointer pt-10"
            style={{ x: rightX, y: rightY }}
            whileHover={{ scale: 1.02, transition: { duration: 0.3 } }}
            onClick={onSellProperty}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === "Enter" && onSellProperty()}
          >
            <div
              className="absolute inset-0"
              style={{ filter: "grayscale(100%) contrast(1.89) brightness(1.15)" }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/hello/sell.jpg"
                alt=""
                className="w-full h-full object-cover"
              />
            </div>
            <div
              className="absolute inset-0 bg-white/70 pointer-events-none"
              aria-hidden
            />
            <motion.div
              className="relative z-10 w-full pl-8 pr-8"
              style={{ x: rightInnerX, y: rightInnerY }}
            >
              <p
                className="text-[66px] text-[#161616] tracking-tight text-left leading-[1.0]"
                style={{
                  fontFamily:
                    "var(--font-dm-serif-display), Georgia, serif",
                  fontWeight: 400,
                }}
              >
                Sell your property
              </p>
            </motion.div>
          </motion.div>
        </div>

        <div className="flex flex-col items-center gap-2 mt-10">
          <a
            href="/"
            className="text-base text-[#666] hover:text-[#333] transition-colors px-4 py-2 rounded-full bg-black/5 hover:bg-black/10 font-medium tracking-wide"
          >
            Enter site
          </a>
          <button
            type="button"
            onClick={onBack}
            className="p-2 text-[#666] hover:text-[#333] transition-colors rounded-full hover:bg-black/5"
            aria-label="Back to overview"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

/**
 * Portfolio tile manifest. Each entry's aspect ratio matches the
 * natural shape of the corresponding WebP in /public/hello/portfolio/
 * so images render without cropping inside the masonry grid.
 *
 * Order is intentionally shuffled (not numerical) so the visual
 * rhythm across the grid feels varied rather than batched.
 */
const PORTFOLIO_TILES: Array<{ n: number; aspect: string }> = [
  { n: 27, aspect: "aspect-[2/3]" },
  { n: 14, aspect: "aspect-[3/2]" },
  { n: 50, aspect: "aspect-[3/4]" },
  { n: 6, aspect: "aspect-[3/2]" },
  { n: 33, aspect: "aspect-[16/9]" },
  { n: 1, aspect: "aspect-[9/16]" },
  { n: 21, aspect: "aspect-[9/16]" },
  { n: 47, aspect: "aspect-[2/3]" },
  { n: 12, aspect: "aspect-[3/2]" },
  { n: 35, aspect: "aspect-[16/9]" },
  { n: 8, aspect: "aspect-[3/2]" },
  { n: 4, aspect: "aspect-square" },
  { n: 19, aspect: "aspect-[3/2]" },
  { n: 30, aspect: "aspect-[2/3]" },
  { n: 26, aspect: "aspect-[3/4]" },
  { n: 41, aspect: "aspect-[3/2]" },
  { n: 22, aspect: "aspect-[3/2]" },
  { n: 45, aspect: "aspect-[9/16]" },
  { n: 10, aspect: "aspect-[3/2]" },
  { n: 39, aspect: "aspect-[3/2]" },
  { n: 37, aspect: "aspect-[9/16]" },
  { n: 17, aspect: "aspect-[3/2]" },
  { n: 51, aspect: "aspect-[16/9]" },
  { n: 25, aspect: "aspect-[3/4]" },
  { n: 29, aspect: "aspect-[3/2]" },
  { n: 5, aspect: "aspect-[16/9]" },
  { n: 18, aspect: "aspect-[2/3]" },
  { n: 13, aspect: "aspect-[3/2]" },
  { n: 38, aspect: "aspect-[16/9]" },
  { n: 16, aspect: "aspect-[3/2]" },
  { n: 9, aspect: "aspect-[2/3]" },
  { n: 42, aspect: "aspect-[3/4]" },
  { n: 31, aspect: "aspect-[16/9]" },
  { n: 11, aspect: "aspect-[3/2]" },
  { n: 44, aspect: "aspect-[2/3]" },
  { n: 3, aspect: "aspect-[9/16]" },
  { n: 24, aspect: "aspect-[3/2]" },
  { n: 28, aspect: "aspect-[16/9]" },
  { n: 20, aspect: "aspect-[2/3]" },
  { n: 49, aspect: "aspect-[16/9]" },
  { n: 36, aspect: "aspect-[3/2]" },
  { n: 2, aspect: "aspect-[9/16]" },
  { n: 15, aspect: "aspect-[3/2]" },
  { n: 46, aspect: "aspect-[9/16]" },
  { n: 7, aspect: "aspect-[3/2]" },
  { n: 32, aspect: "aspect-[16/9]" },
  { n: 23, aspect: "aspect-[3/2]" },
  { n: 40, aspect: "aspect-[16/9]" },
  { n: 48, aspect: "aspect-[16/9]" },
  { n: 43, aspect: "aspect-[3/2]" },
  { n: 34, aspect: "aspect-[16/9]" },
];

function InfiniteMediaView({
  activeTab,
  onTabChange,
  onClose,
}: {
  activeTab: InfiniteTab;
  onTabChange: (t: InfiniteTab) => void;
  onClose: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <motion.div
      className="fixed inset-0 z-50 flex flex-col bg-[#0a0a0a] overflow-hidden"
      // Long, gradual opacity fade — no scale (which can read as a
      // snap) and a small delay so the panel only starts materializing
      // once the cards screen behind it has finished its exit. The
      // result reads as a slow dissolve into the dark space rather
      // than a sudden cover.
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 1.4, ease: "easeOut", delay: 0.1 }}
    >
      <nav className="flex-shrink-0 flex items-center gap-8 p-6 z-20">
        <button
          type="button"
          onClick={() => onTabChange("services")}
          className="relative py-2 px-4 text-white font-medium text-[15px]"
        >
          {activeTab === "services" && (
            <motion.div
              layoutId="infinite-nav-highlight"
              className="absolute inset-0 rounded-lg bg-white/20"
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
            />
          )}
          <span className="relative z-10">Services</span>
        </button>
        <button
          type="button"
          onClick={() => onTabChange("portfolio")}
          className="relative py-2 px-4 text-white font-medium text-[15px]"
        >
          {activeTab === "portfolio" && (
            <motion.div
              layoutId="infinite-nav-highlight"
              className="absolute inset-0 rounded-lg bg-white/20"
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
            />
          )}
          <span className="relative z-10">Portfolio</span>
        </button>
        <button
          type="button"
          onClick={() => onTabChange("contact")}
          className="relative py-2 px-4 text-white font-medium text-[15px]"
        >
          {activeTab === "contact" && (
            <motion.div
              layoutId="infinite-nav-highlight"
              className="absolute inset-0 rounded-lg bg-white/20"
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
            />
          )}
          <span className="relative z-10">Contact</span>
        </button>
      </nav>

      <div className="flex-1 min-h-0 relative">
        <AnimatePresence mode="wait">
          {activeTab === "contact" ? (
            <motion.div
              key="contact"
              className="absolute inset-0 flex items-center justify-center px-6 py-8 overflow-y-auto"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <InfiniteContactForm />
            </motion.div>
          ) : activeTab === "services" ? (
            <motion.div
              key="services"
              className="absolute inset-0 flex flex-row"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <div className="flex-1 min-w-0 bg-[#0a0a0a] relative overflow-hidden">
                <AnimatePresence mode="wait">
                  {menuOpen ? (
                    <motion.div
                      key="menu"
                      className="absolute inset-0 flex flex-col justify-center items-center px-5 sm:px-10 lg:px-14 py-10 overflow-y-auto overflow-x-hidden no-scrollbar"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
                    >
                      <button
                        type="button"
                        onClick={() => setMenuOpen(false)}
                        className="absolute top-6 left-6 p-2 text-white/60 hover:text-white transition-colors rounded-full hover:bg-white/10"
                        aria-label="Close menu"
                      >
                        <svg
                          width="18"
                          height="18"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M18 6L6 18M6 6l12 12" />
                        </svg>
                      </button>
                      <motion.div
                        className="flex flex-col gap-6 sm:gap-8 w-full max-w-full sm:max-w-[440px] origin-center sm:scale-[0.85]"
                        initial={{ y: 10, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ duration: 0.45, delay: 0.05, ease: [0.25, 0.46, 0.45, 0.94] }}
                      >
                        <div className="text-center flex flex-col gap-1">
                          <span className="font-serif italic text-white/60 text-[16px] tracking-wide">
                            Infinite Media
                          </span>
                          <span className="font-sans text-[11.5px] tracking-[0.4em] uppercase text-white/40">
                            Menu of Services
                          </span>
                        </div>

                        {[
                          {
                            section: "Visual",
                            items: [
                              { name: "Photography", desc: "portraits, product, editorial" },
                              { name: "Videography", desc: "films, reels, commercials" },
                              { name: "Drone Footage", desc: "aerial, cinematic, survey" },
                            ],
                          },
                          {
                            section: "Content",
                            items: [
                              { name: "Social Media Content", desc: "posts, reels, stories" },
                              { name: "Podcast Production", desc: "recording, edit, launch" },
                              { name: "Event Coverage", desc: "launches, galas, live" },
                            ],
                          },
                          {
                            section: "Design",
                            items: [
                              { name: "Web Design", desc: "landing pages, full sites, e-commerce" },
                              { name: "Branding", desc: "identity, systems, guides" },
                              { name: "Graphic Design", desc: "logos, decks, signage, packaging" },
                            ],
                          },
                          {
                            section: "Direction",
                            items: [
                              { name: "Brand Direction", desc: "voice, positioning, look & feel" },
                              { name: "Marketing Direction", desc: "campaigns, launches, channels" },
                            ],
                          },
                          {
                            section: "Strategy",
                            items: [
                              { name: "Content Strategy", desc: "planning, calendars, audits" },
                              { name: "Media Consulting", desc: "roadmaps, advisory, training" },
                            ],
                          },
                        ].map((group) => (
                          <div key={group.section} className="flex flex-col gap-3">
                            <div className="flex items-center gap-3">
                              <span className="h-px flex-1 bg-white/15" />
                              <span className="font-serif italic text-white/70 text-[17px] tracking-wide">
                                {group.section}
                              </span>
                              <span className="h-px flex-1 bg-white/15" />
                            </div>
                            <div className="flex flex-col gap-1.5">
                              {group.items.map((item) => (
                                <div
                                  key={item.name}
                                  className="flex flex-col items-start gap-0.5 sm:flex-row sm:items-baseline sm:gap-2 text-white py-0.5 sm:py-0"
                                >
                                  <span className="font-serif text-[22px] sm:text-[20px] tracking-tight sm:whitespace-nowrap">
                                    {item.name}
                                  </span>
                                  <span
                                    className="hidden sm:block flex-1 border-b border-dotted border-white/20 translate-y-[-4px]"
                                    aria-hidden
                                  />
                                  <span className="font-sans text-white/60 text-[12.5px] sm:text-[12px] tracking-[0.12em] uppercase sm:whitespace-nowrap">
                                    {item.desc}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}

                        <p className="text-center font-serif italic text-white/40 text-[14px] tracking-wide pt-2">
                          — available by inquiry —
                        </p>
                      </motion.div>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="hero"
                      className="absolute inset-0 flex flex-col justify-between px-6 sm:px-12 lg:px-16 py-8 sm:py-12"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
                    >
                      <div className="h-4" aria-hidden />

                      <motion.div
                        className="flex flex-col gap-8 max-w-[620px]"
                        initial={{ y: 14, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ duration: 0.6, delay: 0.1, ease: [0.25, 0.46, 0.45, 0.94] }}
                      >
                        <h2 className="font-serif text-white text-[clamp(3.4rem,7.5vw,6.25rem)] leading-[1] tracking-[-0.02em]">
                          Stories
                          <br />
                          <span className="italic text-white/80">worth</span>
                          <br />
                          telling.
                        </h2>
                        <p className="font-sans text-white/55 text-[18px] leading-[1.65] max-w-[480px]">
                          A creative studio producing impactful moments for brands with something to say.
                        </p>
                        <button
                          type="button"
                          onClick={() => setMenuOpen(true)}
                          className="group self-start flex items-center gap-4 mt-2"
                        >
                          <span className="font-sans text-[14px] tracking-[0.3em] uppercase text-white/80 group-hover:text-white transition-colors">
                            View Menu
                          </span>
                          <span className="w-12 h-px bg-white/40 group-hover:bg-white group-hover:w-16 transition-all duration-300" />
                        </button>
                      </motion.div>

                      <div className="h-4" aria-hidden />

                      <span className="absolute bottom-6 right-6 font-sans text-white/50 text-[10px] tracking-[0.35em] uppercase">
                        Greater Seattle Area
                      </span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              {/* Right column width is the midpoint between the
                  original 40vw layout and the fully-square 40vh layout
                  (~55vh). Photo stays square via aspect-square w-full,
                  so it grows along with the column. */}
              <div className="flex-shrink-0 w-[55vh] min-h-0 flex flex-col">
                <div className="flex-1 min-h-0 overflow-x-auto overflow-y-hidden relative no-scrollbar">
                  <motion.div
                    className="will-change-transform"
                    animate={{ y: ["0%", "-50%"] }}
                    transition={{
                      duration: 40,
                      ease: "linear",
                      repeat: Infinity,
                    }}
                  >
                    {[0, 1].map((rep) => (
                      <div key={rep} aria-hidden={rep === 1 ? true : undefined}>
                        {SERVICES.map((s, i) => (
                          <div
                            key={`${rep}-${i}`}
                            className="font-serif text-[clamp(3rem,7vw,5.5rem)] font-normal text-white leading-[0.95] whitespace-nowrap tracking-tight"
                          >
                            {s}
                          </div>
                        ))}
                      </div>
                    ))}
                  </motion.div>
                </div>
                <div className="flex-shrink-0 w-full h-[44vh] min-h-[200px] bg-[#1a1a1a] overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/hello/infinite-media-services.jpg"
                    alt="The Infinite Media team and clients gathered in front of a Seattle home"
                    className="w-full h-full object-cover object-center"
                  />
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="portfolio"
              className="absolute inset-0 overflow-y-auto no-scrollbar"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              {/* CSS columns give a true masonry layout — each tile
                  takes natural height per its aspect ratio and flows
                  into whichever column has space. break-inside-avoid
                  prevents tiles from being split across columns. */}
              <div className="columns-2 md:columns-3 lg:columns-4 gap-[2px] px-[2px] pb-[2px]">
                {PORTFOLIO_TILES.map((tile, i) => (
                  <div
                    key={i}
                    className={`${tile.aspect} w-full relative overflow-hidden bg-[#1a1a1a] mb-[2px] break-inside-avoid group`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`/hello/portfolio/img-${String(tile.n).padStart(2, "0")}.webp`}
                      alt=""
                      loading="lazy"
                      className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.04]"
                    />
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="absolute bottom-6 left-6 z-20 pointer-events-none">
        <span className="font-serif text-white text-sm tracking-wide">
          Infinite Media
        </span>
      </div>
      <button
        type="button"
        className="absolute top-6 right-6 p-2 text-white/70 hover:text-white transition-colors rounded-full hover:bg-white/10 z-20"
        onClick={onClose}
        aria-label="Close"
      >
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>
    </motion.div>
  );
}

/**
 * InfiniteContactForm — simple inquiry form rendered inside the Infinite
 * Media "Contact" tab. Submits to /api/forms/submit with the existing
 * "Infinite Media - Contact Form" form_name, so the entry lands in the
 * same Supabase table as the marketing forms and triggers the Resend
 * notification email to randy@btinvestments.co.
 */
// Same service list as the menu — single source of truth for the
// checkbox group on the contact form.
const INFINITE_MEDIA_SERVICES = [
  "Photography",
  "Videography",
  "Drone Footage",
  "Social Media Content",
  "Podcast Production",
  "Event Coverage",
  "Web Design",
  "Branding",
  "Graphic Design",
  "Brand Direction",
  "Marketing Direction",
  "Content Strategy",
  "Media Consulting",
];

function InfiniteContactForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [services, setServices] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = !!(name.trim() && email.trim() && message.trim());

  function toggleService(s: string) {
    setServices((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const data: Record<string, string> = {
        Name: name.trim(),
        Email: email.trim(),
        Message: message.trim(),
      };
      if (services.length > 0)
        data["Services Interested"] = services.join(", ");
      const res = await fetch("/api/forms/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          form_name: "Infinite Media - Contact Form",
          data,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body?.error ?? "Submission failed. Please try again.");
        setSubmitting(false);
        return;
      }
      setSubmitted(true);
    } catch {
      setError("Submission failed. Please check your connection.");
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass =
    "w-full px-4 py-3 rounded-xl bg-[#1a1a1a] border border-[#333] text-white placeholder:text-[#666] font-sans text-[15px] focus:outline-none focus:border-white/40 transition-colors disabled:opacity-60";

  if (submitted) {
    return (
      <div className="max-w-md w-full text-center flex flex-col items-center gap-4">
        <div className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center">
          <svg
            width="26"
            height="26"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <h2 className="font-serif text-white text-[28px] leading-tight">
          Message received.
        </h2>
        <p className="font-sans text-white/60 text-[14px] leading-relaxed max-w-sm">
          We&apos;ll get back to you within a couple of business days.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="max-w-lg w-full flex flex-col gap-4"
    >
      <div className="text-center mb-2">
        <h2 className="font-serif text-white text-[32px] leading-tight">
          Let&apos;s build something.
        </h2>
        <p className="font-sans text-white/55 text-[13px] mt-2 leading-relaxed">
          Tell us about the project and we&apos;ll be in touch.
        </p>
      </div>
      <input
        type="text"
        placeholder="Your name *"
        value={name}
        onChange={(e) => setName(e.target.value)}
        disabled={submitting}
        className={inputClass}
        aria-label="Your name"
      />
      <input
        type="email"
        placeholder="Email *"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        disabled={submitting}
        className={inputClass}
        aria-label="Email"
      />
      <textarea
        placeholder="Tell us about your project *"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        disabled={submitting}
        rows={4}
        className={`${inputClass} resize-none`}
        aria-label="Message"
      />

      {/* Services checkbox group — pill-style, multi-select. */}
      <div className="flex flex-col gap-2">
        <span className="font-sans text-white/50 text-[11px] tracking-[0.18em] uppercase">
          Services interested in
        </span>
        <div className="flex flex-wrap gap-1.5">
          {INFINITE_MEDIA_SERVICES.map((s) => {
            const active = services.includes(s);
            return (
              <button
                key={s}
                type="button"
                onClick={() => toggleService(s)}
                disabled={submitting}
                className={`px-3 py-1.5 rounded-full font-sans text-[12.5px] transition-colors disabled:opacity-50 ${
                  active
                    ? "bg-white text-[#0a0a0a] border border-white"
                    : "bg-transparent text-white/75 border border-white/25 hover:border-white/60 hover:text-white"
                }`}
              >
                {s}
              </button>
            );
          })}
        </div>
      </div>

      {error && (
        <p className="font-sans text-[13px] text-[#ff8a8a]">{error}</p>
      )}
      <button
        type="submit"
        disabled={!canSubmit || submitting}
        className="mt-2 px-6 py-3 rounded-full bg-white text-[#0a0a0a] font-sans text-[14px] font-medium hover:bg-white/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed self-center min-w-[160px]"
      >
        {submitting ? "Sending…" : "Send Message"}
      </button>
    </form>
  );
}

function SignalWaitlist({
  email,
  onEmailChange,
  submitted,
  submitting,
  error,
  onSubmit,
  onClose,
}: {
  email: string;
  onEmailChange: (v: string) => void;
  submitted: boolean;
  submitting: boolean;
  error: string | null;
  onSubmit: () => void;
  onClose: () => void;
}) {
  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#2a2a2a]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      <motion.div
        className="relative bg-[#3a3a3a] rounded-2xl shadow-2xl px-12 py-6 flex flex-col items-center gap-4 max-w-md w-full mx-4"
        initial={{ opacity: 0, scale: 0.92, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1, ease: [0.25, 0.46, 0.45, 0.94] }}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-[#999] hover:text-white transition-colors rounded-full hover:bg-white/10"
          aria-label="Close"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
        {submitted ? (
          <p className="font-serif text-[28px] text-white text-center leading-tight">
            See you soon 😉
          </p>
        ) : (
          <>
            <p className="font-serif text-[28px] text-white text-center leading-tight">
              Join the waiting list 😏
            </p>
            <div className="w-full flex items-center gap-2">
              <input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => onEmailChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && email.trim() && !submitting) {
                    e.preventDefault();
                    onSubmit();
                  }
                }}
                disabled={submitting}
                className="flex-1 min-w-0 px-4 py-3.5 rounded-xl bg-[#2a2a2a] border border-[#4a4a4a] text-white placeholder:text-[#888] font-sans text-[15px] focus:outline-none focus:border-[#6d8048] focus:ring-1 focus:ring-[#6d8048] transition-colors disabled:opacity-60"
                aria-label="Email"
              />
              {email.trim().length > 0 && (
                <button
                  type="button"
                  onClick={onSubmit}
                  disabled={submitting}
                  className="flex-shrink-0 w-10 h-10 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center font-sans text-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                  aria-label="Submit"
                >
                  {submitting ? "…" : ">"}
                </button>
              )}
            </div>
            {error && (
              <p className="font-sans text-[12px] text-[#ff8a8a] text-center">
                {error}
              </p>
            )}
          </>
        )}
      </motion.div>
    </motion.div>
  );
}
