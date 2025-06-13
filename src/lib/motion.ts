import type { Variants, Transition } from "framer-motion";

// ────────────────────────────────────────────────────────────
// Shared easings
// ────────────────────────────────────────────────────────────

export const smooth: Transition = { type: "tween", ease: [0.25, 0.1, 0.25, 1], duration: 0.4 };
export const spring: Transition = { type: "spring", stiffness: 300, damping: 30 };
export const gentleSpring: Transition = { type: "spring", stiffness: 200, damping: 25 };

// ────────────────────────────────────────────────────────────
// Page transitions
// ────────────────────────────────────────────────────────────

export const pageVariants: Variants = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.25, ease: [0.25, 0.1, 0.25, 1] } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.2 } },
};

// ────────────────────────────────────────────────────────────
// Stagger container
// ────────────────────────────────────────────────────────────

export const staggerContainer: Variants = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: 0.04,
      delayChildren: 0.05,
    },
  },
};

// ────────────────────────────────────────────────────────────
// Fade-up item (for cards, rows, list items)
// ────────────────────────────────────────────────────────────

export const fadeUpItem: Variants = {
  initial: { opacity: 0, y: 8 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.25, ease: [0.25, 0.1, 0.25, 1] },
  },
};

// ────────────────────────────────────────────────────────────
// Scale-fade (dialogs, modals)
// ────────────────────────────────────────────────────────────

export const scaleFade: Variants = {
  initial: { opacity: 0, scale: 0.95 },
  animate: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.25, ease: [0.25, 0.1, 0.25, 1] },
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    transition: { duration: 0.15 },
  },
};

// ────────────────────────────────────────────────────────────
// Button motion props
// ────────────────────────────────────────────────────────────

export const buttonMotion = {
  whileHover: { scale: 1.02 },
  whileTap: { scale: 0.97 },
  transition: { type: "spring" as const, stiffness: 400, damping: 25 },
};

// ────────────────────────────────────────────────────────────
// Table row variants
// ────────────────────────────────────────────────────────────

export const tableRowVariants: Variants = {
  initial: { opacity: 0, x: -4 },
  animate: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.2, ease: [0.25, 0.1, 0.25, 1] },
  },
  exit: {
    opacity: 0,
    x: 4,
    transition: { duration: 0.15 },
  },
};

// ────────────────────────────────────────────────────────────
// Animated counter settings
// ────────────────────────────────────────────────────────────

export const counterConfig = {
  duration: 0.6,
  ease: [0.25, 0.1, 0.25, 1] as [number, number, number, number],
};
