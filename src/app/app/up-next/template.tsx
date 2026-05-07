"use client";

import { motion } from "framer-motion";

/**
 * Per-route template for /app/up-next. Stacks on top of the parent
 * /app template's fade-in. Slightly longer duration plus a soft
 * scale-from-97% gives the queue a cinematic enter rather than the
 * snappier feel of the rest of the app.
 */
export default function UpNextTemplate({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.36, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
