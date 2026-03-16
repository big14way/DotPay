"use client";

import { formatUSDC } from "@/lib/utils";

export function AmountDisplay({
  amount,
  className = "",
  size = "md",
}: {
  amount: bigint | number;
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const sizeClasses = {
    sm: "text-sm",
    md: "text-base",
    lg: "text-2xl font-bold",
  };

  return (
    <span className={`${sizeClasses[size]} font-mono ${className}`}>
      {formatUSDC(amount)}
    </span>
  );
}
