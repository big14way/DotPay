"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { TransactionButton } from "@/components/TransactionButton";
import { useCreateEscrow } from "@/hooks/useCreateEscrow";
import { useTokenApproval } from "@/hooks/useTokenApproval";
import { useUSDCBalance } from "@/hooks/useBalance";
import { CONTRACTS } from "@/config/contracts";
import { formatUSDC, parseUSDC } from "@/lib/utils";
import { ArrowRight, Info, ExternalLink, CheckCircle } from "lucide-react";
import Link from "next/link";

export default function SendPage() {
  const { isConnected } = useAccount();
  const [seller, setSeller] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [yieldEnabled, setYieldEnabled] = useState(false);
  const [rail, setRail] = useState(0);
  const [deadlineDays, setDeadlineDays] = useState("30");

  const parsedAmount = amount ? parseUSDC(amount) : 0n;
  const { balance } = useUSDCBalance();
  const { needsApproval, approve, isApproving } = useTokenApproval(
    CONTRACTS.InvoiceCore,
    parsedAmount
  );
  const { createEscrow, isPending, isConfirming, isSuccess, txHash } =
    useCreateEscrow();

  const deadlineTimestamp =
    Math.floor(Date.now() / 1000) + Number(deadlineDays) * 86400;

  const handleSubmit = async () => {
    if (needsApproval) {
      await approve();
      return;
    }
    await createEscrow({
      seller: seller as `0x${string}`,
      amount,
      deadline: deadlineTimestamp,
      yieldEnabled,
      rail,
      description,
    });
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
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-white mb-2">Create Escrow</h1>
        <p className="text-[var(--dot-muted)] text-sm mb-8">
          Send USDC to a seller with escrow protection
        </p>

        <div className="bg-surface border border-dot rounded-xl p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-white mb-2">
              Seller Address
            </label>
            <input
              type="text"
              value={seller}
              onChange={(e) => setSeller(e.target.value)}
              placeholder="0x..."
              className="w-full bg-[var(--dot-bg)] border border-dot rounded-xl px-4 py-3 text-white placeholder:text-[var(--dot-muted)] focus:outline-none focus:border-[var(--dot-primary)] font-mono text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white mb-2">
              Amount (USDC)
            </label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              min="0"
              step="0.01"
              className="w-full bg-[var(--dot-bg)] border border-dot rounded-xl px-4 py-3 text-white placeholder:text-[var(--dot-muted)] focus:outline-none focus:border-[var(--dot-primary)] font-mono text-sm"
            />
            {balance !== undefined && (
              <p className="text-xs text-[var(--dot-muted)] mt-1">
                Balance: {formatUSDC(balance)}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-white mb-2">
              Description
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, 32))}
              placeholder="Invoice #123, Services, etc."
              maxLength={32}
              className="w-full bg-[var(--dot-bg)] border border-dot rounded-xl px-4 py-3 text-white placeholder:text-[var(--dot-muted)] focus:outline-none focus:border-[var(--dot-primary)] text-sm"
            />
            <p className="text-xs text-[var(--dot-muted)] mt-1">
              {description.length}/32 characters (stored on-chain as bytes32)
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-white mb-2">
              Deadline (days from now)
            </label>
            <input
              type="number"
              value={deadlineDays}
              onChange={(e) => setDeadlineDays(e.target.value)}
              min="1"
              max="365"
              className="w-full bg-[var(--dot-bg)] border border-dot rounded-xl px-4 py-3 text-white placeholder:text-[var(--dot-muted)] focus:outline-none focus:border-[var(--dot-primary)] font-mono text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white mb-2">
              Settlement Rail
            </label>
            <select
              value={rail}
              onChange={(e) => setRail(Number(e.target.value))}
              className="w-full bg-[var(--dot-bg)] border border-dot rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[var(--dot-primary)] text-sm"
            >
              <option value={0}>Direct USDC</option>
              <option value={1}>Yield Enabled</option>
              <option value={2}>Fiat Rails (NGN/KES/GHS)</option>
            </select>
          </div>

          <div className="flex items-center gap-3">
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={yieldEnabled}
                onChange={(e) => setYieldEnabled(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-[var(--dot-border)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--dot-primary)]" />
            </label>
            <div>
              <span className="text-sm font-medium text-white">
                Enable Yield
              </span>
              <p className="text-xs text-[var(--dot-muted)]">
                Route escrowed USDC through Hydration for 5% APY
              </p>
            </div>
          </div>

          {isSuccess && txHash ? (
            <div className="bg-[var(--dot-success)]/10 border border-[var(--dot-success)]/20 rounded-xl p-5 text-center space-y-3">
              <CheckCircle className="w-10 h-10 text-[var(--dot-success)] mx-auto" />
              <p className="text-[var(--dot-success)] font-bold text-lg">
                Escrow Created Successfully!
              </p>
              <div className="flex flex-col gap-2">
                <a
                  href={`https://blockscout-testnet.polkadot.io/tx/${txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-1.5 text-sm text-[var(--dot-primary)] hover:underline"
                >
                  View Transaction on Explorer <ExternalLink className="w-3.5 h-3.5" />
                </a>
                <Link
                  href="/escrows"
                  className="text-sm text-white hover:text-[var(--dot-primary)] transition-colors"
                >
                  View My Escrows
                </Link>
              </div>
            </div>
          ) : isConfirming ? (
            <div className="bg-[var(--dot-primary)]/10 border border-[var(--dot-primary)]/20 rounded-xl p-4 text-center space-y-2">
              <div className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-[var(--dot-primary)] border-t-transparent rounded-full animate-spin" />
                <p className="text-[var(--dot-primary)] font-medium">
                  Confirming on-chain...
                </p>
              </div>
              {txHash && (
                <a
                  href={`https://blockscout-testnet.polkadot.io/tx/${txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-[var(--dot-muted)] hover:text-[var(--dot-primary)]"
                >
                  Track on Explorer <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          ) : (
            <TransactionButton
              onClick={handleSubmit}
              loading={isPending || isApproving}
              disabled={!seller || !amount || parsedAmount === 0n}
              className="w-full"
            >
              {needsApproval ? (
                "Approve USDC"
              ) : isPending ? (
                "Confirm in Wallet..."
              ) : (
                <span className="flex items-center gap-2">
                  Create Escrow <ArrowRight className="w-4 h-4" />
                </span>
              )}
            </TransactionButton>
          )}
        </div>
      </div>
    </main>
  );
}
