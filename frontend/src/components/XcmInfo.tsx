"use client";

import { cn } from "@/lib/utils";
import { ArrowRightLeft, Globe } from "lucide-react";

export function XcmInfo({
  sourceChain = "Polkadot Hub",
  destChain = "Hydration",
  status = "idle",
}: {
  sourceChain?: string;
  destChain?: string;
  status?: "idle" | "pending" | "success" | "error";
}) {
  const statusColors = {
    idle: "text-[var(--dot-muted)]",
    pending: "text-[var(--dot-warning)]",
    success: "text-[var(--dot-success)]",
    error: "text-red-400",
  };

  return (
    <div className="bg-surface border border-dot rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Globe className="w-4 h-4 text-[var(--dot-primary)]" />
        <span className="text-sm font-medium text-white">
          Cross-Chain Route
        </span>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex-1 text-center">
          <p className="text-xs text-[var(--dot-muted)] mb-1">Source</p>
          <p className="text-sm font-medium text-white">{sourceChain}</p>
        </div>
        <ArrowRightLeft
          className={cn("w-5 h-5 shrink-0", statusColors[status])}
        />
        <div className="flex-1 text-center">
          <p className="text-xs text-[var(--dot-muted)] mb-1">Destination</p>
          <p className="text-sm font-medium text-white">{destChain}</p>
        </div>
      </div>
      {status !== "idle" && (
        <p
          className={cn(
            "text-xs text-center mt-2 capitalize",
            statusColors[status]
          )}
        >
          {status}
        </p>
      )}
    </div>
  );
}
