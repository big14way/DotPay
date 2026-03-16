"use client";

import { cn, getStatusColor, getStatusLabel } from "@/lib/utils";

export function StatusBadge({ status }: { status: number }) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border",
        getStatusColor(status)
      )}
    >
      {getStatusLabel(status)}
    </span>
  );
}
