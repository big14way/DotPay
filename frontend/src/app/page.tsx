"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";

export default function Home() {
  return (
    <main className="min-h-screen bg-dotpay-darker">
      <nav className="flex items-center justify-between px-8 py-4 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-dotpay-gradient" />
          <span className="text-xl font-bold text-gradient">DotPay</span>
        </div>
        <ConnectButton />
      </nav>

      <div className="flex flex-col items-center justify-center px-4 pt-32">
        <h1 className="text-5xl md:text-7xl font-bold text-center mb-6">
          <span className="text-gradient">Blockchain-Native</span>
          <br />
          <span className="text-white">Payments for Africa</span>
        </h1>
        <p className="text-lg text-gray-400 text-center max-w-2xl mb-12">
          Create USDC escrows, tokenize invoices as NFTs, earn yield on locked
          funds, borrow against escrow, and settle to African fiat rails — all
          from one beautiful interface.
        </p>
        <div className="flex gap-4">
          <button className="px-8 py-3 rounded-lg bg-dotpay-gradient text-white font-semibold hover:opacity-90 transition-opacity">
            Launch App
          </button>
          <button className="px-8 py-3 rounded-lg border border-white/20 text-white font-semibold hover:bg-white/5 transition-colors">
            Learn More
          </button>
        </div>
      </div>
    </main>
  );
}
