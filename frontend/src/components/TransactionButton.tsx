"use client";

import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

export function TransactionButton({
  onClick,
  disabled = false,
  loading = false,
  children,
  variant = "primary",
  className = "",
}: {
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "danger";
  className?: string;
}) {
  const variants = {
    primary: "bg-dot-gradient hover:opacity-90 text-white",
    secondary:
      "border border-dot text-white hover:bg-white/5",
    danger:
      "bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20",
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={cn(
        "px-6 py-3 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        variants[variant],
        className
      )}
    >
      {loading && <Loader2 className="w-4 h-4 animate-spin" />}
      {children}
    </button>
  );
}
