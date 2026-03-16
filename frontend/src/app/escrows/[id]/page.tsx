"use client";

import { useParams } from "next/navigation";
import { useAccount } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useEscrow } from "@/hooks/useEscrows";
import { useYield } from "@/hooks/useYield";
import { useReleaseEscrow } from "@/hooks/useReleaseEscrow";
import { StatusBadge } from "@/components/StatusBadge";
import { CopyAddress } from "@/components/CopyAddress";
import { AmountDisplay } from "@/components/AmountDisplay";
import { YieldCounter } from "@/components/YieldCounter";
import { Timeline, TimelineItem } from "@/components/Timeline";
import { TransactionButton } from "@/components/TransactionButton";
import {
  formatUSDC,
  timeAgo,
  getRailLabel,
  explorerLink,
} from "@/lib/utils";
import {
  ArrowLeft,
  Clock,
  ExternalLink,
  Shield,
  Zap,
  AlertTriangle,
} from "lucide-react";
import Link from "next/link";

export default function EscrowDetailPage() {
  const params = useParams();
  const id = BigInt(params.id as string);
  const { address } = useAccount();
  const { escrow, isLoading, refetch } = useEscrow(id);
  const { yieldAccrued, borrowLimit, debt } = useYield(id);
  const { release, refund, dispute, isPending, isConfirming, txHash: actionTxHash } =
    useReleaseEscrow();

  if (isLoading || !escrow) {
    return (
      <main className="min-h-screen pt-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-[var(--dot-border)] rounded w-48" />
            <div className="h-64 bg-[var(--dot-border)] rounded-xl" />
          </div>
        </div>
      </main>
    );
  }

  const isBuyer = address?.toLowerCase() === escrow.buyer.toLowerCase();
  const isSeller = address?.toLowerCase() === escrow.seller.toLowerCase();
  const isActive = escrow.status === 0;

  const timelineItems: TimelineItem[] = [
    {
      label: "Escrow Created",
      timestamp: timeAgo(escrow.createdAt),
      completed: true,
    },
    {
      label: "Funds Locked",
      timestamp: timeAgo(escrow.createdAt),
      completed: true,
    },
    {
      label: escrow.yieldEnabled ? "Yield Routing Active" : "Direct Hold",
      completed: escrow.yieldEnabled,
      active: isActive && escrow.yieldEnabled,
    },
    {
      label:
        escrow.status === 1
          ? "Released"
          : escrow.status === 2
          ? "Refunded"
          : escrow.status === 3
          ? "Disputed"
          : "Awaiting Action",
      timestamp:
        escrow.releasedAt > 0n ? timeAgo(escrow.releasedAt) : undefined,
      completed: escrow.status !== 0,
      active: isActive,
    },
  ];

  const handleAction = async (
    action: "release" | "refund" | "dispute"
  ) => {
    if (action === "release") await release(id);
    else if (action === "refund") await refund(id);
    else await dispute(id);
    refetch();
  };

  return (
    <main className="min-h-screen pt-20">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link
          href="/escrows"
          className="inline-flex items-center gap-2 text-[var(--dot-muted)] hover:text-white text-sm mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Escrows
        </Link>

        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-white">
              Escrow #{escrow.id.toString()}
            </h1>
            <StatusBadge status={escrow.status} />
          </div>
          <a
            href={explorerLink(
              "address",
              "0xe3D37E5c036CC0bb4E0A170D49cc9212ABc8f985"
            )}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--dot-muted)] hover:text-white transition-colors"
          >
            <ExternalLink className="w-5 h-5" />
          </a>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-surface border border-dot rounded-xl p-6">
              <h2 className="text-lg font-bold text-white mb-4">Details</h2>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-[var(--dot-muted)]">
                    Amount
                  </span>
                  <AmountDisplay amount={escrow.amount} size="lg" />
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-[var(--dot-muted)]">
                    Buyer
                  </span>
                  <CopyAddress address={escrow.buyer} />
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-[var(--dot-muted)]">
                    Seller
                  </span>
                  <CopyAddress address={escrow.seller} />
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-[var(--dot-muted)]">
                    Settlement Rail
                  </span>
                  <span className="text-white text-sm">
                    {getRailLabel(escrow.rail)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-[var(--dot-muted)]">
                    Deadline
                  </span>
                  <span className="text-white text-sm flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    {timeAgo(escrow.deadline)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-[var(--dot-muted)]">
                    NFT Token ID
                  </span>
                  <span className="text-white text-sm font-mono">
                    #{escrow.nftTokenId.toString()}
                  </span>
                </div>
              </div>
            </div>

            {escrow.yieldEnabled && isActive && (
              <div className="bg-surface border border-dot rounded-xl p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Zap className="w-5 h-5 text-[var(--dot-success)]" />
                  <h2 className="text-lg font-bold text-white">Yield</h2>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-[var(--dot-muted)]">
                      Live Yield
                    </span>
                    <YieldCounter
                      baseAmount={escrow.amount}
                      startTimestamp={escrow.createdAt}
                    />
                  </div>
                  {yieldAccrued !== undefined && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-[var(--dot-muted)]">
                        On-chain Accrued
                      </span>
                      <span className="font-mono text-[var(--dot-success)] text-sm">
                        {formatUSDC(yieldAccrued)}
                      </span>
                    </div>
                  )}
                  {borrowLimit !== undefined && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-[var(--dot-muted)]">
                        Borrow Limit (80% LTV)
                      </span>
                      <span className="font-mono text-white text-sm">
                        {formatUSDC(borrowLimit)}
                      </span>
                    </div>
                  )}
                  {debt !== undefined && debt > 0n && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-[var(--dot-muted)]">
                        Outstanding Debt
                      </span>
                      <span className="font-mono text-[var(--dot-warning)] text-sm">
                        {formatUSDC(debt)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {isActive && (isBuyer || isSeller) && (
              <div className="bg-surface border border-dot rounded-xl p-6">
                <h2 className="text-lg font-bold text-white mb-4">Actions</h2>
                {isConfirming && actionTxHash ? (
                  <div className="bg-[var(--dot-primary)]/10 border border-[var(--dot-primary)]/20 rounded-xl p-4 space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-[var(--dot-primary)] border-t-transparent rounded-full animate-spin" />
                      <p className="text-[var(--dot-primary)] font-medium text-sm">
                        Confirming transaction...
                      </p>
                    </div>
                    <a
                      href={`https://blockscout-testnet.polkadot.io/tx/${actionTxHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-[var(--dot-muted)] hover:text-[var(--dot-primary)]"
                    >
                      Track on Explorer <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-3">
                    {isBuyer && (
                      <>
                        <TransactionButton
                          onClick={() => handleAction("release")}
                          loading={isPending}
                          variant="primary"
                        >
                          {isPending ? "Confirm in Wallet..." : "Release Funds"}
                        </TransactionButton>
                        <TransactionButton
                          onClick={() => handleAction("dispute")}
                          loading={isPending}
                          variant="danger"
                        >
                          <AlertTriangle className="w-4 h-4" /> Dispute
                        </TransactionButton>
                      </>
                    )}
                    {isSeller && (
                      <TransactionButton
                        onClick={() => handleAction("refund")}
                        loading={isPending}
                        variant="secondary"
                      >
                        {isPending ? "Confirm in Wallet..." : "Refund Buyer"}
                      </TransactionButton>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <div>
            <div className="bg-surface border border-dot rounded-xl p-6">
              <h2 className="text-lg font-bold text-white mb-4">Timeline</h2>
              <Timeline items={timelineItems} />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
