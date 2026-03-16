"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="bg-surface border border-dot rounded-xl p-8 max-w-md text-center">
        <h2 className="text-xl font-bold text-white mb-3">Something went wrong</h2>
        <p className="text-sm text-[var(--dot-muted)] mb-2">
          {error.message?.includes("ethereum")
            ? "A wallet extension conflict was detected. Try disabling other wallet extensions (keep only MetaMask) or open in an Incognito window."
            : error.message || "An unexpected error occurred."}
        </p>
        <div className="flex gap-3 justify-center mt-6">
          <button
            onClick={reset}
            className="px-5 py-2.5 rounded-xl bg-dot-gradient text-white font-semibold text-sm hover:opacity-90"
          >
            Try Again
          </button>
          <a
            href="/"
            className="px-5 py-2.5 rounded-xl border border-dot text-[var(--dot-muted)] text-sm hover:text-white"
          >
            Go Home
          </a>
        </div>
      </div>
    </div>
  );
}
