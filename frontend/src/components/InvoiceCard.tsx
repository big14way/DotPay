"use client";

import { formatUSDC, shortenAddress } from "@/lib/utils";
import { Tag, TrendingDown } from "lucide-react";

export interface ListingData {
  id: bigint;
  escrowId: bigint;
  tokenId: bigint;
  seller: string;
  listPrice: bigint;
  faceValue: bigint;
  active: boolean;
}

export function InvoiceCard({
  listing,
  onBuy,
  loading = false,
}: {
  listing: ListingData;
  onBuy?: (listingId: bigint) => void;
  loading?: boolean;
}) {
  const discount =
    listing.faceValue > 0n
      ? Number(
          ((listing.faceValue - listing.listPrice) * 10000n) /
            listing.faceValue
        ) / 100
      : 0;

  return (
    <div className="bg-surface border border-dot rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Tag className="w-4 h-4 text-[var(--dot-primary)]" />
          <span className="text-sm font-mono text-[var(--dot-muted)]">
            NFT #{listing.tokenId.toString()}
          </span>
        </div>
        {listing.active && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--dot-success)]/10 text-[var(--dot-success)] border border-[var(--dot-success)]/20">
            Active
          </span>
        )}
      </div>

      <div className="space-y-3 mb-4">
        <div>
          <p className="text-xs text-[var(--dot-muted)] mb-1">Face Value</p>
          <p className="text-lg font-bold text-white">
            {formatUSDC(listing.faceValue)}
          </p>
        </div>
        <div>
          <p className="text-xs text-[var(--dot-muted)] mb-1">List Price</p>
          <p className="text-lg font-bold text-[var(--dot-success)]">
            {formatUSDC(listing.listPrice)}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between text-sm mb-4">
        <div className="flex items-center gap-1 text-[var(--dot-primary)]">
          <TrendingDown className="w-3.5 h-3.5" />
          <span>{discount.toFixed(2)}% discount</span>
        </div>
        <span className="text-[var(--dot-muted)] font-mono">
          {shortenAddress(listing.seller)}
        </span>
      </div>

      {onBuy && listing.active && (
        <button
          onClick={() => onBuy(listing.id)}
          disabled={loading}
          className="w-full py-2.5 rounded-xl bg-dot-gradient text-white font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {loading ? "Buying..." : "Buy Invoice"}
        </button>
      )}
    </div>
  );
}
