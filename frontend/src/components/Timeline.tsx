"use client";

import { cn } from "@/lib/utils";
import { Check, Circle } from "lucide-react";

export interface TimelineItem {
  label: string;
  timestamp?: string;
  completed: boolean;
  active?: boolean;
}

export function Timeline({ items }: { items: TimelineItem[] }) {
  return (
    <div className="space-y-0">
      {items.map((item, i) => (
        <div key={i} className="flex gap-3">
          <div className="flex flex-col items-center">
            <div
              className={cn(
                "w-6 h-6 rounded-full flex items-center justify-center border",
                item.completed
                  ? "bg-[var(--dot-success)]/20 border-[var(--dot-success)]"
                  : item.active
                  ? "bg-[var(--dot-primary)]/20 border-[var(--dot-primary)]"
                  : "bg-transparent border-[var(--dot-border)]"
              )}
            >
              {item.completed ? (
                <Check className="w-3 h-3 text-[var(--dot-success)]" />
              ) : (
                <Circle
                  className={cn(
                    "w-2 h-2",
                    item.active
                      ? "fill-[var(--dot-primary)] text-[var(--dot-primary)]"
                      : "fill-[var(--dot-muted)] text-[var(--dot-muted)]"
                  )}
                />
              )}
            </div>
            {i < items.length - 1 && (
              <div
                className={cn(
                  "w-px h-8",
                  item.completed
                    ? "bg-[var(--dot-success)]/30"
                    : "bg-[var(--dot-border)]"
                )}
              />
            )}
          </div>
          <div className="pb-8">
            <p
              className={cn(
                "text-sm font-medium",
                item.completed
                  ? "text-white"
                  : item.active
                  ? "text-[var(--dot-primary)]"
                  : "text-[var(--dot-muted)]"
              )}
            >
              {item.label}
            </p>
            {item.timestamp && (
              <p className="text-xs text-[var(--dot-muted)] mt-0.5">
                {item.timestamp}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
