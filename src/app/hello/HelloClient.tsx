"use client";

import { useEffect, useRef, useState } from "react";
import {
  motion,
  AnimatePresence,
  useMotionValue,
  useSpring,
  useTransform,
} from "framer-motion";

const TARGET_WIDTH = 884 * 0.78;
const TARGET_HEIGHT = 520 * 0.78;
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

type InfiniteTab = "services" | "portfolio";

function urlForState(screen: Screen, tab: InfiniteTab): string {
  switch (screen) {
    case "cards":
    case "buyers":
      return "/hello";
    case "form":
      return "/join-buyers-list";
    case "sellForm":
      return "/sell-property";
    case "signalWaitlist":
      return "/signal";
    case "infiniteMedia":
      return tab === "portfolio" ? "/infinite-media/portfolio" : "/infinite-media";
  }
}

function stateFromUrl(pathname: string): { screen: Screen; tab: InfiniteTab } {
  if (pathname.startsWith("/join-buyers-list"))
    return { screen: "form", tab: "services" };
  if (pathname.startsWith("/sell-property"))
    return { screen: "sellForm", tab: "services" };
  if (pathname.startsWith("/signal"))
    return { screen: "signalWaitlist", tab: "services" };
  if (pathname.startsWith("/infinite-media/portfolio"))
    return { screen: "infiniteMedia", tab: "portfolio" };
  if (pathname.startsWith("/infinite-media"))
    return { screen: "infiniteMedia", tab: "services" };
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
};

export default function HelloClient({
  initialScreen = "cards",
  initialInfiniteTab = "services",
}: HelloClientProps = {}) {
  const [screen, setScreen] = useState<Screen>(initialScreen);
  const [infiniteTab, setInfiniteTab] = useState<InfiniteTab>(initialInfiniteTab);
  const [waitlistEmail, setWaitlistEmail] = useState("");
  const [waitlistSubmitted, setWaitlistSubmitted] = useState(false);

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
              <BuyersForm key="form" fit={fit} onBack={() => setScreen("buyers")} />
            )}

            {screen === "sellForm" && (
              <SellForm key="sellForm" fit={fit} onBack={() => setScreen("buyers")} />
            )}

            {screen === "infiniteMedia" && (
              <InfiniteMediaView
                key="infiniteMedia"
                activeTab={infiniteTab}
                onTabChange={setInfiniteTab}
                onClose={() => setScreen("cards")}
              />
            )}

            {screen === "signalWaitlist" && (
              <SignalWaitlist
                key="signalWaitlist"
                email={waitlistEmail}
                onEmailChange={setWaitlistEmail}
                submitted={waitlistSubmitted}
                onSubmit={() => setWaitlistSubmitted(true)}
                onClose={closeWaitlist}
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
          className="relative w-[300px] h-[520px] rounded-[32px] overflow-hidden group shadow-[0_20px_50px_rgba(0,0,0,0.08)] bg-[#e0ddd1] cursor-pointer"
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
            <h2 className="font-serif text-[42px] leading-[1] text-[#1a1a18] tracking-[-0.04em] font-bold">
              BT
            </h2>
            <h3 className="font-serif text-[32px] leading-[0.9] text-[#6d8048] italic mt-1 font-medium tracking-[-0.02em]">
              Investments
            </h3>
          </motion.div>
        </motion.div>

        {/* Signal card */}
        <motion.div
          className="relative w-[300px] h-[520px] rounded-[32px] overflow-hidden bg-[#f4f2ef] shadow-[0_25px_60px_rgba(0,0,0,0.06)] flex flex-col items-center justify-center group cursor-pointer"
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
              className="font-serif text-[61.2px] text-[#161616] leading-[0.9] tracking-[-0.03em] font-semibold"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.8 }}
            >
              Signal
            </motion.h1>
            <motion.p
              className="font-sans text-[15px] text-[#444] mt-3 font-normal tracking-wide"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.8 }}
            >
              An AI company.
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
            className="relative w-[252px] h-[252px] rounded-[32px] overflow-hidden shadow-[0_15px_40px_rgba(0,0,0,0.05)] group cursor-pointer"
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
              <h2 className="font-serif text-[26px] leading-[1.1] text-[#222] font-semibold tracking-tight">
                Infinite
                <br />
                Media
              </h2>
              <p className="font-sans text-[12.5px] text-[#5c5953] mt-0.5 font-medium tracking-tight">
                Photo, Video, Web Design, and more
              </p>
            </motion.div>
          </motion.div>

          {/* Infinite RE */}
          <motion.div
            className="relative w-[252px] h-[252px] rounded-[32px] overflow-hidden group shadow-[0_15px_40px_rgba(0,0,0,0.06)]"
            whileHover={{ scale: 1.05, transition: { duration: 0.4, ease: "easeOut" } }}
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
              <h2 className="font-serif text-[26.4px] text-[#222] font-semibold tracking-tight flex items-baseline gap-[2px]">
                Infinite
                <span className="text-[22px] text-[#b49a5c] italic font-medium">
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
              <p className="font-serif text-[61px] text-[#161616] font-bold tracking-tight text-left leading-[1.05]">
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
              <p className="font-serif text-[61px] text-[#161616] font-bold tracking-tight text-left leading-[1.05]">
                Sell your property
              </p>
            </motion.div>
          </motion.div>
        </div>

        <div className="flex flex-col items-center gap-2 mt-10">
          <a
            href="https://BTInvestments.co"
            target="_blank"
            rel="noopener noreferrer"
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

function BuyersForm({ fit, onBack }: { fit: number; onBack: () => void }) {
  return (
    <motion.div
      className="relative w-[620px] max-w-[92vw] rounded-[32px] bg-[#f4f2ef] shadow-[0_4px_12px_rgba(0,0,0,0.02)] py-10 px-10 flex flex-col gap-6 origin-center"
      initial={{ opacity: 0, scale: 0.96 * fit }}
      animate={{ opacity: 1, scale: fit }}
      exit={{
        opacity: 0,
        scale: 0.96 * fit,
        transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] },
      }}
      transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      <button
        type="button"
        onClick={onBack}
        className="absolute top-6 right-6 p-2 text-[#666] hover:text-[#333] transition-colors rounded-full hover:bg-black/5"
        aria-label="Back to options"
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
      <h2 className="font-serif text-[28px] text-[#161616] font-semibold tracking-tight">
        Join our buyers list
      </h2>
      <div className="flex flex-col gap-4">
        <input
          type="text"
          placeholder="Name"
          className="w-full px-4 py-3 rounded-xl border border-[#ddd] bg-white text-[#161616] placeholder:text-[#888] font-sans text-[15px] focus:outline-none focus:border-[#999]"
          aria-label="Name"
        />
        <input
          type="email"
          placeholder="Email"
          className="w-full px-4 py-3 rounded-xl border border-[#ddd] bg-white text-[#161616] placeholder:text-[#888] font-sans text-[15px] focus:outline-none focus:border-[#999]"
          aria-label="Email"
        />
        <input
          type="text"
          placeholder="Message"
          className="w-full px-4 py-3 rounded-xl border border-[#ddd] bg-white text-[#161616] placeholder:text-[#888] font-sans text-[15px] focus:outline-none focus:border-[#999]"
          aria-label="Message"
        />
      </div>
      <button
        type="button"
        className="self-start px-5 py-2.5 rounded-full bg-[#6d8048] text-white font-sans text-[14px] font-medium hover:bg-[#5a6b35] transition-colors"
      >
        Submit
      </button>
    </motion.div>
  );
}

function SellForm({ fit, onBack }: { fit: number; onBack: () => void }) {
  return (
    <motion.div
      className="relative w-[620px] max-w-[92vw] rounded-[32px] bg-[#f4f2ef] shadow-[0_4px_12px_rgba(0,0,0,0.02)] py-10 px-10 flex flex-col gap-6 origin-center"
      initial={{ opacity: 0, scale: 0.96 * fit }}
      animate={{ opacity: 1, scale: fit }}
      exit={{
        opacity: 0,
        scale: 0.96 * fit,
        transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] },
      }}
      transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      <button
        type="button"
        onClick={onBack}
        className="absolute top-6 right-6 p-2 text-[#666] hover:text-[#333] transition-colors rounded-full hover:bg-black/5"
        aria-label="Back to options"
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
      <h2 className="font-serif text-[28px] text-[#161616] font-semibold tracking-tight">
        Sell your property
      </h2>
      <div className="flex flex-col gap-4">
        <input
          type="text"
          placeholder="Property address"
          className="w-full px-4 py-3 rounded-xl border border-[#ddd] bg-white text-[#161616] placeholder:text-[#888] font-sans text-[15px] focus:outline-none focus:border-[#999]"
          aria-label="Property address"
        />
        <input
          type="email"
          placeholder="Email"
          className="w-full px-4 py-3 rounded-xl border border-[#ddd] bg-white text-[#161616] placeholder:text-[#888] font-sans text-[15px] focus:outline-none focus:border-[#999]"
          aria-label="Email"
        />
      </div>
      <button
        type="button"
        className="self-start px-5 py-2.5 rounded-full bg-[#6d8048] text-white font-sans text-[14px] font-medium hover:bg-[#5a6b35] transition-colors"
      >
        Submit
      </button>
    </motion.div>
  );
}

const PORTFOLIO_TILES: Array<{ color: string; ratio: string; label: string }> = [
  { color: "#d4cfc1", ratio: "aspect-[3/4]", label: "01" },
  { color: "#b8b3a3", ratio: "aspect-[4/3]", label: "02" },
  { color: "#c9c3b0", ratio: "aspect-[1/1]", label: "03" },
  { color: "#a09b8a", ratio: "aspect-[3/4]", label: "04" },
  { color: "#ddd7c6", ratio: "aspect-[4/5]", label: "05" },
  { color: "#b1a994", ratio: "aspect-[1/1]", label: "06" },
  { color: "#cac4b2", ratio: "aspect-[3/4]", label: "07" },
  { color: "#968f7c", ratio: "aspect-[4/3]", label: "08" },
  { color: "#e3ddcc", ratio: "aspect-[3/4]", label: "09" },
  { color: "#aca695", ratio: "aspect-[1/1]", label: "10" },
  { color: "#bdb7a5", ratio: "aspect-[4/5]", label: "11" },
  { color: "#d8d2c0", ratio: "aspect-[3/4]", label: "12" },
  { color: "#9a937f", ratio: "aspect-[4/3]", label: "13" },
  { color: "#c4beac", ratio: "aspect-[1/1]", label: "14" },
  { color: "#b5af9d", ratio: "aspect-[3/4]", label: "15" },
  { color: "#d1cbb8", ratio: "aspect-[4/5]", label: "16" },
  { color: "#a69f8c", ratio: "aspect-[1/1]", label: "17" },
  { color: "#bfb9a7", ratio: "aspect-[3/4]", label: "18" },
  { color: "#918a77", ratio: "aspect-[4/3]", label: "19" },
  { color: "#cec8b5", ratio: "aspect-[3/4]", label: "20" },
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
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
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
      </nav>

      <div className="flex-1 min-h-0 relative">
        <AnimatePresence mode="wait">
          {activeTab === "services" ? (
            <motion.div
              key="services"
              className="absolute inset-0 flex flex-row"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <div className="flex-[60] min-w-0 bg-[#0a0a0a] relative overflow-hidden">
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
                          <span className="font-serif italic text-white/60 text-[14px] tracking-wide">
                            Infinite Media
                          </span>
                          <span className="font-sans text-[10px] tracking-[0.4em] uppercase text-white/40">
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
                              { name: "Web Design", desc: "microsites, e-commerce, CMS" },
                              { name: "Branding", desc: "identity, systems, guides" },
                              { name: "Graphic Design", desc: "print, digital, collateral" },
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
                              <span className="font-serif italic text-white/70 text-[15px] tracking-wide">
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
                                  <span className="font-serif text-[19px] sm:text-[17px] tracking-tight sm:whitespace-nowrap">
                                    {item.name}
                                  </span>
                                  <span
                                    className="hidden sm:block flex-1 border-b border-dotted border-white/20 translate-y-[-4px]"
                                    aria-hidden
                                  />
                                  <span className="font-sans text-white/60 text-[11px] sm:text-[10.5px] tracking-[0.12em] uppercase sm:whitespace-nowrap">
                                    {item.desc}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}

                        <p className="text-center font-serif italic text-white/40 text-[12px] tracking-wide pt-2">
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
                        <h2 className="font-serif text-white text-[clamp(2.75rem,6vw,5rem)] leading-[1] tracking-[-0.02em]">
                          Work that
                          <br />
                          <span className="italic text-white/80">holds your</span>
                          <br />
                          attention.
                        </h2>
                        <p className="font-sans text-white/55 text-[14px] leading-[1.65] max-w-[380px]">
                          A creative studio producing film, photography, design, and sound for brands with something to say.
                        </p>
                        <button
                          type="button"
                          onClick={() => setMenuOpen(true)}
                          className="group self-start flex items-center gap-3 mt-2"
                        >
                          <span className="font-sans text-[11px] tracking-[0.3em] uppercase text-white/80 group-hover:text-white transition-colors">
                            View Menu
                          </span>
                          <span className="w-10 h-px bg-white/40 group-hover:bg-white group-hover:w-14 transition-all duration-300" />
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
              <div className="flex-[40] min-w-0 min-h-0 flex flex-col">
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
                <div className="flex-shrink-0 w-full h-[40vh] min-h-[200px] bg-[#1a1a1a] overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=1200&auto=format&fit=crop"
                    alt=""
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
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-[2px] px-[2px] pb-[2px]">
                {PORTFOLIO_TILES.map((tile, i) => (
                  <div
                    key={i}
                    className={`${tile.ratio} w-full relative overflow-hidden`}
                    style={{ backgroundColor: tile.color }}
                  >
                    <span className="absolute bottom-3 left-3 font-sans text-[10px] tracking-widest uppercase text-black/40">
                      {tile.label}
                    </span>
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

function SignalWaitlist({
  email,
  onEmailChange,
  submitted,
  onSubmit,
  onClose,
}: {
  email: string;
  onEmailChange: (v: string) => void;
  submitted: boolean;
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
                  if (e.key === "Enter" && email.trim()) {
                    e.preventDefault();
                    onSubmit();
                  }
                }}
                className="flex-1 min-w-0 px-4 py-3.5 rounded-xl bg-[#2a2a2a] border border-[#4a4a4a] text-white placeholder:text-[#888] font-sans text-[15px] focus:outline-none focus:border-[#6d8048] focus:ring-1 focus:ring-[#6d8048] transition-colors"
                aria-label="Email"
              />
              {email.trim().length > 0 && (
                <button
                  type="button"
                  onClick={onSubmit}
                  className="flex-shrink-0 w-10 h-10 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center font-sans text-lg transition-colors"
                  aria-label="Submit"
                >
                  &gt;
                </button>
              )}
            </div>
          </>
        )}
      </motion.div>
    </motion.div>
  );
}
