"use client";

import Link from "next/link";
import { formatUSDC, shortenAddress, timeAgo, getRailLabel } from "@/lib/utils";
import { StatusBadge } from "./StatusBadge";
import { ArrowRight, Clock, Zap } from "lucide-react";

export interface EscrowData {
  id: bigint;
  buyer: string;
  seller: string;
  amount: bigint;
  yieldAccrued: bigint;
  createdAt: bigint;
  releasedAt: bigint;
  deadline: bigint;
  status: number;
  rail: number;
  yieldEnabled: boolean;
  nftTokenId: bigint;
  description: string;
}

export function EscrowCard({ escrow }: { escrow: EscrowData }) {
  return (
    <Link href={`/escrows/${escrow.id.toString()}`}>
      <div className="bg-surface border border-dot rounded-xl p-5 hover:border-[var(--dot-primary)]/30 transition-all group cursor-pointer">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--dot-muted)] font-mono">
              #{escrow.id.toString()}
            </span>
            <StatusBadge status={escrow.status} />
          </div>
          <ArrowRight className="w-4 h-4 text-[var(--dot-muted)] group-hover:text-[var(--dot-primary)] transition-colors" />
        </div>

        <p className="text-xl font-bold text-white mb-3">
          {formatUSDC(escrow.amount)}
        </p>

        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-[var(--dot-muted)]">To</span>
            <span className="font-mono text-white">
              {shortenAddress(escrow.seller)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--dot-muted)]">From</span>
            <span className="font-mono text-white">
              {shortenAddress(escrow.buyer)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--dot-muted)]">Rail</span>
            <span className="text-white">{getRailLabel(escrow.rail)}</span>
          </div>
        </div>

        <div className="flex items-center gap-3 mt-3 pt-3 border-t border-dot">
          <div className="flex items-center gap-1 text-xs text-[var(--dot-muted)]">
            <Clock className="w-3 h-3" />
            {timeAgo(escrow.createdAt)}
          </div>
          {escrow.yieldEnabled && (
            <div className="flex items-center gap-1 text-xs text-[var(--dot-success)]">
              <Zap className="w-3 h-3" />
              Yield Active
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
