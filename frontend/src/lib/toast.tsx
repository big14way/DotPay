"use client";

import toast from "react-hot-toast";
import { ExternalLink, CheckCircle, XCircle, Loader2 } from "lucide-react";

const EXPLORER = "https://blockscout-testnet.polkadot.io";

export function txSubmittedToast(hash: string, label = "Transaction") {
  return toast(
    (t) => (
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-[#E6007A]" />
          <span className="font-medium text-sm">{label} submitted</span>
        </div>
        <p className="text-xs text-[#6B7280]">Waiting for confirmation...</p>
        <a
          href={`${EXPLORER}/tx/${hash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs text-[#E6007A] hover:underline mt-0.5"
        >
          View on Explorer <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    ),
    {
      duration: 15000,
      style: {
        background: "#13131A",
        color: "#FAFAFA",
        border: "1px solid #1E1E2E",
        maxWidth: "380px",
      },
    }
  );
}

export function txSuccessToast(hash: string, label = "Transaction") {
  return toast(
    (t) => (
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-[#00D395]" />
          <span className="font-medium text-sm">{label} confirmed!</span>
        </div>
        <a
          href={`${EXPLORER}/tx/${hash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs text-[#E6007A] hover:underline"
        >
          View on Explorer <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    ),
    {
      duration: 6000,
      style: {
        background: "#13131A",
        color: "#FAFAFA",
        border: "1px solid #00D395",
        maxWidth: "380px",
      },
    }
  );
}

export function txErrorToast(error: any) {
  const message =
    error?.shortMessage ||
    error?.message?.slice(0, 120) ||
    "Transaction failed";

  return toast(
    (t) => (
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <XCircle className="w-4 h-4 text-red-400" />
          <span className="font-medium text-sm">Transaction Failed</span>
        </div>
        <p className="text-xs text-[#6B7280]">{message}</p>
      </div>
    ),
    {
      duration: 6000,
      style: {
        background: "#13131A",
        color: "#FAFAFA",
        border: "1px solid #ef4444",
        maxWidth: "380px",
      },
    }
  );
}
