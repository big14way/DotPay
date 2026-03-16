"use client";

import { useAccount } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { InvoiceCard } from "@/components/InvoiceCard";
import { useMarket, useBuyInvoice } from "@/hooks/useMarket";
import { useTokenApproval } from "@/hooks/useTokenApproval";
import { CONTRACTS } from "@/config/contracts";
import { ShoppingCart, Tag } from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";

export default function MarketPage() {
  const { isConnected } = useAccount();
  const { activeListings, listings } = useMarket();
  const { buyInvoice, isPending, isConfirming } = useBuyInvoice();
  const [buyingId, setBuyingId] = useState<bigint | null>(null);

  const currentListing = buyingId !== null
    ? listings.find((l) => l.id === buyingId)
    : null;
  const approvalAmount = currentListing?.listPrice ?? 0n;

  const { needsApproval, approve, isApproving } = useTokenApproval(
    CONTRACTS.InvoiceMarket,
    approvalAmount
  );

  const handleBuy = async (listingId: bigint) => {
    setBuyingId(listingId);
    try {
      if (needsApproval) {
        await approve();
      }
      await buyInvoice(listingId);
    } catch {
      // error handled in hook
    }
    setBuyingId(null);
  };

  if (!isConnected) {
    return (
      <main className="min-h-screen pt-20 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-4">
            Connect Wallet
          </h1>
          <ConnectButton />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen pt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white">
              Invoice Marketplace
            </h1>
            <p className="text-[var(--dot-muted)] text-sm mt-1">
              Buy tokenized invoices at a discount
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm text-[var(--dot-muted)]">
            <Tag className="w-4 h-4" />
            {activeListings.length} active listing
            {activeListings.length !== 1 ? "s" : ""}
          </div>
        </div>

        {activeListings.length === 0 ? (
          <div className="bg-surface border border-dot rounded-xl p-12 text-center">
            <ShoppingCart className="w-12 h-12 text-[var(--dot-muted)] mx-auto mb-4" />
            <p className="text-[var(--dot-muted)] mb-2">
              No invoices listed for sale
            </p>
            <p className="text-xs text-[var(--dot-muted)]">
              Sellers can list their escrow invoice NFTs on the marketplace
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeListings.map((listing) => (
              <InvoiceCard
                key={listing.id.toString()}
                listing={listing}
                onBuy={handleBuy}
                loading={
                  buyingId === listing.id &&
                  (isPending || isConfirming || isApproving)
                }
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
