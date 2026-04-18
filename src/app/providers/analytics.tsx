"use client";

import { useEffect } from "react";
import { initPosthog } from "@/lib/analytics/posthog";

export function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    initPosthog();
  }, []);
  return <>{children}</>;
}
