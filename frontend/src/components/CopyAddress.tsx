"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { shortenAddress } from "@/lib/utils";

export function CopyAddress({
  address,
  chars = 4,
  className = "",
}: {
  address: string;
  chars?: number;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className={`inline-flex items-center gap-1.5 text-[var(--dot-muted)] hover:text-white transition-colors font-mono text-sm ${className}`}
    >
      {shortenAddress(address, chars)}
      {copied ? (
        <Check className="w-3.5 h-3.5 text-[var(--dot-success)]" />
      ) : (
        <Copy className="w-3.5 h-3.5" />
      )}
    </button>
  );
}
