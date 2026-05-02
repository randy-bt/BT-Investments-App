"use client";

import { motion } from "framer-motion";

/**
 * Root template — Next.js re-instantiates this on every real route
 * navigation (unlike layout.tsx which persists), so the motion.div is
 * a fresh instance per page and the entrance animation runs naturally.
 *
 * Important: NO `key={pathname}` here. window.history.pushState (used
 * by HelloClient to keep its URL in sync with internal screen state)
 * silently updates usePathname's value, and a pathname-keyed wrapper
 * would force the entire HelloClient subtree to re-mount on every
 * Hello-internal click — which manifested as "nothing happens" when
 * clicking the Signal / Infinite Media cards.
 */
export default function RootTemplate({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}
