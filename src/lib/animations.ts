// Cosmos.so-inspired animation system
// All animations use ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1)

export const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const;

export const fadeInUp = {
  hidden: { opacity: 0, y: 40 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, ease: EASE_OUT_EXPO },
  },
};

export const fadeIn = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.7, ease: EASE_OUT_EXPO },
  },
};

export const staggerContainer = (delay = 0.06) => ({
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: delay },
  },
});

export const wordReveal = (i: number) => ({
  hidden: { opacity: 0, y: 30, filter: "blur(6px)" },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: {
      delay: i * 0.06,
      duration: 0.7,
      ease: EASE_OUT_EXPO,
    },
  },
});

export const cardReveal = (i: number) => ({
  hidden: { opacity: 0, y: 50, scale: 0.97 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      delay: i * 0.06,
      duration: 0.7,
      ease: EASE_OUT_EXPO,
    },
  },
});

export const slideInLeft = (i: number = 0) => ({
  hidden: { opacity: 0, x: -40 },
  visible: {
    opacity: 1,
    x: 0,
    transition: {
      delay: i * 0.06,
      duration: 0.7,
      ease: EASE_OUT_EXPO,
    },
  },
});

export const scaleIn = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.7, ease: EASE_OUT_EXPO },
  },
};
