"use client";

import { useAccount } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { StatsCard } from "@/components/StatsCard";
import { EscrowCard } from "@/components/EscrowCard";
import { XcmInfo } from "@/components/XcmInfo";
import { useEscrows } from "@/hooks/useEscrows";
import { useVaultStats } from "@/hooks/useYield";
import { formatUSDC } from "@/lib/utils";
import { TrendingUp, Zap, Lock, ArrowRightLeft } from "lucide-react";

export default function YieldPage() {
  const { isConnected } = useAccount();
  const { myEscrows } = useEscrows();
  const { totalDeposits, apyBps } = useVaultStats();

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

  const yieldEscrows = myEscrows.filter(
    (e) => e.yieldEnabled && e.status === 0
  );
  const totalLocked = yieldEscrows.reduce(
    (sum, e) => sum + Number(e.amount),
    0
  );
  const totalYieldAccrued = yieldEscrows.reduce(
    (sum, e) => sum + Number(e.yieldAccrued),
    0
  );

  return (
    <main className="min-h-screen pt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white">Yield Dashboard</h1>
          <p className="text-[var(--dot-muted)] text-sm mt-1">
            Earn yield on escrowed USDC via Hydration cross-chain routing
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatsCard
            label="Your Yield Escrows"
            value={yieldEscrows.length.toString()}
            icon={<Zap className="w-5 h-5" />}
          />
          <StatsCard
            label="Total Locked"
            value={formatUSDC(BigInt(Math.round(totalLocked)))}
            icon={<Lock className="w-5 h-5" />}
          />
          <StatsCard
            label="Yield Accrued"
            value={formatUSDC(BigInt(Math.round(totalYieldAccrued)))}
            icon={<TrendingUp className="w-5 h-5" />}
          />
          <StatsCard
            label="Current APY"
            value={`${(apyBps / 100).toFixed(1)}%`}
            subValue="via Hydration"
            icon={<ArrowRightLeft className="w-5 h-5" />}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-2">
            <div className="bg-surface border border-dot rounded-xl p-6">
              <h2 className="text-lg font-bold text-white mb-2">
                How It Works
              </h2>
              <div className="space-y-3 text-sm text-[var(--dot-muted)]">
                <p>
                  When you create an escrow with yield enabled, your USDC is
                  routed through the XCM Yield Vault which bridges to Hydration
                  DEX on Polkadot.
                </p>
                <div className="grid grid-cols-3 gap-3 py-3">
                  {[
                    {
                      step: "1",
                      label: "Deposit",
                      desc: "USDC locked in escrow",
                    },
                    {
                      step: "2",
                      label: "Route",
                      desc: "XCM bridge to Hydration",
                    },
                    {
                      step: "3",
                      label: "Earn",
                      desc: `${(apyBps / 100).toFixed(1)}% APY accrues`,
                    },
                  ].map((s) => (
                    <div
                      key={s.step}
                      className="bg-[var(--dot-bg)] rounded-lg p-3 text-center"
                    >
                      <div className="w-6 h-6 rounded-full bg-[var(--dot-primary)]/20 text-[var(--dot-primary)] text-xs font-bold flex items-center justify-center mx-auto mb-2">
                        {s.step}
                      </div>
                      <p className="text-white font-medium text-xs">
                        {s.label}
                      </p>
                      <p className="text-[var(--dot-muted)] text-xs mt-0.5">
                        {s.desc}
                      </p>
                    </div>
                  ))}
                </div>
                <p>
                  Yield is split: 80% to buyer, 15% to seller, 5% platform
                  fee. When the escrow is released, accrued yield is distributed
                  automatically.
                </p>
              </div>
            </div>
          </div>
          <div>
            <XcmInfo
              sourceChain="Polkadot Hub"
              destChain="Hydration"
              status={yieldEscrows.length > 0 ? "success" : "idle"}
            />
            <div className="bg-surface border border-dot rounded-xl p-6 mt-4">
              <h3 className="text-sm font-bold text-white mb-3">
                Vault Stats
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-[var(--dot-muted)]">Total TVL</span>
                  <span className="text-white font-mono">
                    {totalDeposits ? formatUSDC(totalDeposits) : "$0.00"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--dot-muted)]">APY</span>
                  <span className="text-[var(--dot-success)]">
                    {(apyBps / 100).toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--dot-muted)]">Strategy</span>
                  <span className="text-white">Hydration LP</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div>
          <h2 className="text-xl font-bold text-white mb-4">
            Your Yield Escrows
          </h2>
          {yieldEscrows.length === 0 ? (
            <div className="bg-surface border border-dot rounded-xl p-12 text-center">
              <Zap className="w-12 h-12 text-[var(--dot-muted)] mx-auto mb-4" />
              <p className="text-[var(--dot-muted)]">
                No yield-enabled escrows yet
              </p>
              <p className="text-xs text-[var(--dot-muted)] mt-1">
                Enable yield when creating an escrow to start earning
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {yieldEscrows.map((escrow) => (
                <EscrowCard key={escrow.id.toString()} escrow={escrow} />
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
