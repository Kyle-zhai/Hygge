"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Moon, Sun, Monitor } from "lucide-react";

export function ThemeToggle() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: gate initial render until client hydration so the theme icon doesn't flip on first paint
    setMounted(true);
  }, []);

  const current = mounted ? theme ?? "system" : "system";
  const resolved = mounted ? resolvedTheme ?? "light" : "light";

  const cycle = () => {
    if (current === "system") setTheme("light");
    else if (current === "light") setTheme("dark");
    else setTheme("system");
  };

  const label =
    current === "system"
      ? `Follow system (${resolved})`
      : current === "dark"
        ? "Dark mode"
        : "Light mode";

  return (
    <button
      type="button"
      aria-label={`Theme: ${label}. Click to cycle.`}
      title={label}
      onClick={cycle}
      className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg text-[color:var(--text-secondary)] transition-all duration-300 hover:bg-[color:var(--bg-hover)] hover:text-[color:var(--text-primary)]"
      suppressHydrationWarning
    >
      <Sun
        className={`h-[18px] w-[18px] transition-all duration-500 ${
          current === "light" ? "scale-100 rotate-0 opacity-100" : "scale-0 -rotate-90 opacity-0"
        }`}
      />
      <Moon
        className={`absolute h-[18px] w-[18px] transition-all duration-500 ${
          current === "dark" ? "scale-100 rotate-0 opacity-100" : "scale-0 rotate-90 opacity-0"
        }`}
      />
      <Monitor
        className={`absolute h-[18px] w-[18px] transition-all duration-500 ${
          current === "system" ? "scale-100 rotate-0 opacity-100" : "scale-0 rotate-45 opacity-0"
        }`}
      />
    </button>
  );
}
