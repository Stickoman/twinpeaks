"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global error:", error);
  }, [error]);

  return (
    <html lang="en">
      <body className="flex min-h-screen items-center justify-center bg-zinc-950 p-4 font-sans text-zinc-100">
        <div className="max-w-md text-center">
          <h2 className="text-lg font-semibold">Something went wrong</h2>
          <p className="mt-2 text-sm text-zinc-400">
            An unexpected error occurred. Please try again.
          </p>
          <button
            onClick={reset}
            className="mt-4 rounded-md bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-200"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
