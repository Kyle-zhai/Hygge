"use client";

import { useState, useEffect, type ReactNode } from "react";

interface ScrollHeaderProps {
  children: ReactNode;
}

export function ScrollHeader({ children }: ScrollHeaderProps) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    function handleScroll() {
      setScrolled(window.scrollY > 80);
    }
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-50 w-full transition-all duration-300 ${
        scrolled
          ? "border-b border-[color:var(--border-default)] py-0"
          : "bg-transparent py-1"
      }`}
      style={
        scrolled
          ? {
              backgroundColor: "color-mix(in oklab, var(--bg-primary) 85%, transparent)",
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
            }
          : undefined
      }
    >
      {children}
    </header>
  );
}
