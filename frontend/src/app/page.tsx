"use client";

import { useAccount } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import Link from "next/link";
import {
  ArrowUpRight,
  Shield,
  Zap,
  Globe,
  Wallet,
  TrendingUp,
  FileText,
} from "lucide-react";
import { StatsCard } from "@/components/StatsCard";
import { EscrowCard } from "@/components/EscrowCard";
import { useEscrows } from "@/hooks/useEscrows";
import { useUSDCBalance } from "@/hooks/useBalance";
import { useCompliance } from "@/hooks/useCompliance";
import { useVaultStats } from "@/hooks/useYield";
import { formatUSDC } from "@/lib/utils";

export default function Dashboard() {
  const { address, isConnected } = useAccount();
  const { myEscrows, escrowCount } = useEscrows();
  const { balance } = useUSDCBalance();
  const { kycLabel } = useCompliance();
  const { totalDeposits, apyBps } = useVaultStats();

  if (!isConnected) {
    return (
      <main className="min-h-screen pt-16">
        <div className="flex flex-col items-center justify-center px-4 pt-32">
          <h1 className="text-5xl md:text-7xl font-bold text-center mb-6">
            <span className="text-gradient">Blockchain-Native</span>
            <br />
            <span className="text-white">Payments for Africa</span>
          </h1>
          <p className="text-lg text-[var(--dot-muted)] text-center max-w-2xl mb-12">
            Create USDC escrows, tokenize invoices as NFTs, earn yield on locked
            funds, borrow against escrow, and settle to African fiat rails — all
            from one beautiful interface.
          </p>
          <ConnectButton />
        </div>

        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 mt-24 grid grid-cols-1 md:grid-cols-3 gap-6 pb-20">
          {[
            {
              icon: <Shield className="w-8 h-8" />,
              title: "USDC Escrow",
              desc: "Trustless payments with automated release, refund, and dispute flows",
            },
            {
              icon: <TrendingUp className="w-8 h-8" />,
              title: "Yield on Locked Funds",
              desc: "Earn 5% APY on escrowed USDC via Hydration cross-chain yield",
            },
            {
              icon: <Globe className="w-8 h-8" />,
              title: "African Fiat Rails",
              desc: "Settle to NGN, KES, GHS via Pendulum Spacewalk bridge",
            },
          ].map((f) => (
            <div
              key={f.title}
              className="bg-surface border border-dot rounded-xl p-6 text-center"
            >
              <div className="text-[var(--dot-primary)] mb-4 flex justify-center">
                {f.icon}
              </div>
              <h3 className="text-lg font-bold text-white mb-2">{f.title}</h3>
              <p className="text-sm text-[var(--dot-muted)]">{f.desc}</p>
            </div>
          ))}
        </div>
      </main>
    );
  }

  const activeEscrows = myEscrows.filter((e) => e.status === 0);
  const totalVolume = myEscrows.reduce(
    (sum, e) => sum + Number(e.amount),
    0
  );

  return (
    <main className="min-h-screen pt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white">Dashboard</h1>
            <p className="text-[var(--dot-muted)] text-sm mt-1">
              Welcome back to DotPay
            </p>
          </div>
          <Link
            href="/send"
            className="px-5 py-2.5 rounded-xl bg-dot-gradient text-white font-semibold text-sm hover:opacity-90 transition-opacity flex items-center gap-2"
          >
            New Escrow <ArrowUpRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatsCard
            label="USDC Balance"
            value={balance ? formatUSDC(balance) : "$0.00"}
            icon={<Wallet className="w-5 h-5" />}
          />
          <StatsCard
            label="Active Escrows"
            value={activeEscrows.length.toString()}
            subValue={`${escrowCount} total on-chain`}
            icon={<FileText className="w-5 h-5" />}
          />
          <StatsCard
            label="Vault TVL"
            value={totalDeposits ? formatUSDC(totalDeposits) : "$0.00"}
            subValue={`${(apyBps / 100).toFixed(1)}% APY`}
            icon={<TrendingUp className="w-5 h-5" />}
          />
          <StatsCard
            label="KYC Status"
            value={kycLabel}
            icon={<Shield className="w-5 h-5" />}
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-white">Recent Escrows</h2>
            <Link
              href="/escrows"
              className="text-sm text-[var(--dot-primary)] hover:underline"
            >
              View all
            </Link>
          </div>
          {myEscrows.length === 0 ? (
            <div className="bg-surface border border-dot rounded-xl p-12 text-center">
              <FileText className="w-12 h-12 text-[var(--dot-muted)] mx-auto mb-4" />
              <p className="text-[var(--dot-muted)]">No escrows yet</p>
              <Link
                href="/send"
                className="text-[var(--dot-primary)] text-sm hover:underline mt-2 inline-block"
              >
                Create your first escrow
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {myEscrows.slice(0, 6).map((escrow) => (
                <EscrowCard key={escrow.id.toString()} escrow={escrow} />
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
