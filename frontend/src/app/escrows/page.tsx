"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { EscrowCard } from "@/components/EscrowCard";
import { useEscrows } from "@/hooks/useEscrows";
import { FileText } from "lucide-react";
import Link from "next/link";

type FilterType = "all" | "active" | "released" | "refunded" | "disputed";

export default function EscrowsPage() {
  const { isConnected, address } = useAccount();
  const { myEscrows, allEscrows } = useEscrows();
  const [filter, setFilter] = useState<FilterType>("all");
  const [showAll, setShowAll] = useState(false);

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

  const source = showAll ? allEscrows : myEscrows;
  const statusMap: Record<FilterType, number | null> = {
    all: null,
    active: 0,
    released: 1,
    refunded: 2,
    disputed: 3,
  };
  const filtered =
    filter === "all"
      ? source
      : source.filter((e) => e.status === statusMap[filter]);

  const filters: { key: FilterType; label: string }[] = [
    { key: "all", label: "All" },
    { key: "active", label: "Active" },
    { key: "released", label: "Released" },
    { key: "refunded", label: "Refunded" },
    { key: "disputed", label: "Disputed" },
  ];

  return (
    <main className="min-h-screen pt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold text-white">Escrows</h1>
            <p className="text-[var(--dot-muted)] text-sm mt-1">
              {showAll ? "All on-chain escrows" : "Your escrows"}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowAll(!showAll)}
              className="px-4 py-2 rounded-xl border border-dot text-sm text-white hover:bg-white/5 transition-colors"
            >
              {showAll ? "My Escrows" : "All Escrows"}
            </button>
            <Link
              href="/send"
              className="px-5 py-2.5 rounded-xl bg-dot-gradient text-white font-semibold text-sm hover:opacity-90 transition-opacity"
            >
              New Escrow
            </Link>
          </div>
        </div>

        <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2">
          {filters.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                filter === f.key
                  ? "bg-[var(--dot-primary)]/10 text-[var(--dot-primary)] border border-[var(--dot-primary)]/20"
                  : "text-[var(--dot-muted)] hover:text-white hover:bg-white/5 border border-transparent"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="bg-surface border border-dot rounded-xl p-12 text-center">
            <FileText className="w-12 h-12 text-[var(--dot-muted)] mx-auto mb-4" />
            <p className="text-[var(--dot-muted)]">No escrows found</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((escrow) => (
              <EscrowCard key={escrow.id.toString()} escrow={escrow} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
