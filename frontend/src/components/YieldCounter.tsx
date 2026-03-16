"use client";

import { useEffect, useState } from "react";
import { formatUSDC } from "@/lib/utils";
import { TrendingUp } from "lucide-react";

export function YieldCounter({
  baseAmount,
  apyBps = 500,
  startTimestamp,
}: {
  baseAmount: bigint;
  apyBps?: number;
  startTimestamp: bigint;
}) {
  const [displayYield, setDisplayYield] = useState(0n);

  useEffect(() => {
    const interval = setInterval(() => {
      const now = BigInt(Math.floor(Date.now() / 1000));
      const elapsed = now - startTimestamp;
      if (elapsed <= 0n) {
        setDisplayYield(0n);
        return;
      }
      const secondsInYear = 365n * 24n * 3600n;
      const yieldAmount =
        (baseAmount * BigInt(apyBps) * elapsed) / (10000n * secondsInYear);
      setDisplayYield(yieldAmount);
    }, 1000);

    return () => clearInterval(interval);
  }, [baseAmount, apyBps, startTimestamp]);

  return (
    <div className="flex items-center gap-2">
      <TrendingUp className="w-4 h-4 text-[var(--dot-success)]" />
      <span className="font-mono text-[var(--dot-success)] text-sm">
        +{formatUSDC(displayYield)}
      </span>
      <span className="text-xs text-[var(--dot-muted)]">
        ({(apyBps / 100).toFixed(1)}% APY)
      </span>
    </div>
  );
}
