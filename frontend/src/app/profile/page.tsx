"use client";

import { useAccount } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { CopyAddress } from "@/components/CopyAddress";
import { StatsCard } from "@/components/StatsCard";
import { useCompliance } from "@/hooks/useCompliance";
import { useUSDCBalance, useNativeBalance } from "@/hooks/useBalance";
import { useEscrows } from "@/hooks/useEscrows";
import { formatUSDC, explorerLink } from "@/lib/utils";
import {
  Shield,
  Wallet,
  FileText,
  ExternalLink,
  AlertTriangle,
  CheckCircle,
  User,
  Droplets,
} from "lucide-react";
import { useFaucet, useSetKyc } from "@/hooks/useFaucet";

export default function ProfilePage() {
  const { address, isConnected } = useAccount();
  const { kycLevel, kycLabel, isBlacklisted, txLimit, refetchKyc } = useCompliance();
  const { balance: usdcBalance, refetch: refetchUsdc } = useUSDCBalance();
  const { formatted: nativeBalance, symbol } = useNativeBalance();
  const { myEscrows } = useEscrows();
  const { mintUSDC, isPending: isMinting, isConfirming: isMintConfirming } = useFaucet();
  const { setKyc, isPending: isSettingKyc, isConfirming: isKycConfirming } = useSetKyc();

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

  const activeEscrows = myEscrows.filter((e) => e.status === 0);
  const completedEscrows = myEscrows.filter((e) => e.status === 1);
  const totalVolume = myEscrows.reduce(
    (sum, e) => sum + Number(e.amount),
    0
  );

  const kycColors = [
    "text-red-400 bg-red-400/10 border-red-400/20",
    "text-yellow-400 bg-yellow-400/10 border-yellow-400/20",
    "text-blue-400 bg-blue-400/10 border-blue-400/20",
    "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
  ];

  return (
    <main className="min-h-screen pt-20">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-white mb-8">Profile</h1>

        <div className="bg-surface border border-dot rounded-xl p-6 mb-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 rounded-full bg-dot-gradient flex items-center justify-center">
              <User className="w-8 h-8 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                {address && <CopyAddress address={address} chars={6} />}
                <a
                  href={explorerLink("address", address || "")}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--dot-muted)] hover:text-white transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${kycColors[kycLevel] || kycColors[0]}`}
                >
                  KYC: {kycLabel}
                </span>
                {isBlacklisted && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border text-red-400 bg-red-400/10 border-red-400/20">
                    <AlertTriangle className="w-3 h-3" /> Blacklisted
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-[var(--dot-bg)] rounded-xl p-4">
              <p className="text-xs text-[var(--dot-muted)] mb-1">
                USDC Balance
              </p>
              <p className="text-xl font-bold text-white font-mono">
                {usdcBalance !== undefined ? formatUSDC(usdcBalance) : "$0.00"}
              </p>
            </div>
            <div className="bg-[var(--dot-bg)] rounded-xl p-4">
              <p className="text-xs text-[var(--dot-muted)] mb-1">
                Native Balance
              </p>
              <p className="text-xl font-bold text-white font-mono">
                {nativeBalance ? `${Number(nativeBalance).toFixed(4)} ${symbol}` : "0 PAS"}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 mt-4">
            <button
              onClick={async () => { await mintUSDC(); setTimeout(() => refetchUsdc(), 5000); }}
              disabled={isMinting || isMintConfirming}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-dot-gradient text-white font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {isMinting ? "Confirm in Wallet..." : isMintConfirming ? (
                <><div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> Minting...</>
              ) : (
                <><Droplets className="w-4 h-4" /> Get 10,000 Test USDC</>
              )}
            </button>
            {kycLevel === 0 && address && (
              <button
                onClick={async () => { await setKyc(address, 2); setTimeout(() => refetchKyc(), 5000); }}
                disabled={isSettingKyc || isKycConfirming}
                className="flex items-center gap-2 px-4 py-2 rounded-xl border border-[var(--dot-primary)] text-[var(--dot-primary)] font-semibold text-sm hover:bg-[var(--dot-primary)]/10 transition-colors disabled:opacity-50"
              >
                {isSettingKyc ? "Confirm in Wallet..." : isKycConfirming ? (
                  <><div className="w-3.5 h-3.5 border-2 border-[var(--dot-primary)] border-t-transparent rounded-full animate-spin" /> Setting KYC...</>
                ) : (
                  <><Shield className="w-4 h-4" /> Set KYC Level</>
                )}
              </button>
            )}
            <a
              href="https://faucet.polkadot.io/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-dot text-[var(--dot-muted)] text-sm hover:text-white hover:border-white/20 transition-colors"
            >
              <Wallet className="w-4 h-4" /> Get PAS (Gas)
            </a>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <StatsCard
            label="Active Escrows"
            value={activeEscrows.length.toString()}
            icon={<FileText className="w-5 h-5" />}
          />
          <StatsCard
            label="Completed"
            value={completedEscrows.length.toString()}
            icon={<CheckCircle className="w-5 h-5" />}
          />
          <StatsCard
            label="Total Volume"
            value={formatUSDC(BigInt(Math.round(totalVolume)))}
            icon={<Wallet className="w-5 h-5" />}
          />
        </div>

        <div className="bg-surface border border-dot rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Shield className="w-5 h-5 text-[var(--dot-primary)]" />
            <h2 className="text-lg font-bold text-white">
              Compliance Details
            </h2>
          </div>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-[var(--dot-muted)]">KYC Level</span>
              <span className="text-white">{kycLabel} (Level {kycLevel})</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[var(--dot-muted)]">Transaction Limit</span>
              <span className="text-white font-mono">
                {txLimit !== undefined ? formatUSDC(txLimit) : "N/A"}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[var(--dot-muted)]">Blacklist Status</span>
              <span
                className={
                  isBlacklisted ? "text-red-400" : "text-[var(--dot-success)]"
                }
              >
                {isBlacklisted ? "Blacklisted" : "Clear"}
              </span>
            </div>
          </div>

          <div className="mt-4 p-3 bg-[var(--dot-bg)] rounded-lg">
            <p className="text-xs text-[var(--dot-muted)]">
              KYC levels are set by the ComplianceOracle contract owner. Higher
              KYC levels unlock higher transaction limits. Contact the protocol
              admin to upgrade your KYC level.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
