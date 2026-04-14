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
      <h2 className="text-lg font-semibold text-[#EAEAE8]">Something went wrong</h2>
      <p className="text-sm text-[#666462] max-w-md text-center">
        {error.message || "An unexpected error occurred while loading the report."}
      </p>
      <button
        onClick={reset}
        className="mt-2 rounded-lg border border-[#2A2A2A] bg-[#1C1C1C] px-5 py-2 text-sm text-[#EAEAE8] transition-colors hover:bg-[#222222]"
      >
        Try again
      </button>
    </div>
  );
}
