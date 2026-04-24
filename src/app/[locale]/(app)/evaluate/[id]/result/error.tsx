"use client";

import { useEffect } from "react";

export default function ResultError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[ResultPage Error]", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4">
      <div className="text-4xl">!</div>
      <h2 className="text-lg font-semibold text-[color:var(--text-primary)]">Something went wrong</h2>
      <p className="text-sm text-[color:var(--text-tertiary)] max-w-md text-center">
        {error.message || "An unexpected error occurred while loading the report."}
      </p>
      <button
        onClick={reset}
        className="mt-2 rounded-lg border border-[color:var(--border-default)] bg-[color:var(--bg-tertiary)] px-5 py-2 text-sm text-[color:var(--text-primary)] transition-colors hover:bg-[color:var(--bg-hover)]"
      >
        Try again
      </button>
    </div>
  );
}
