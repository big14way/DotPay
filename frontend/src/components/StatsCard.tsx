"use client";

import { cn } from "@/lib/utils";

export function StatsCard({
  label,
  value,
  subValue,
  icon,
  className = "",
}: {
  label: string;
  value: string;
  subValue?: string;
  icon?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "bg-surface border border-dot rounded-xl p-5 flex flex-col gap-2",
        className
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm text-[var(--dot-muted)]">{label}</span>
        {icon && <div className="text-[var(--dot-muted)]">{icon}</div>}
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
      {subValue && (
        <p className="text-xs text-[var(--dot-muted)]">{subValue}</p>
      )}
    </div>
  );
}
