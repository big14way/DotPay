import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { formatDistanceToNow } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function shortenAddress(address: string, chars = 4): string {
  if (!address) return "";
  return `${address.substring(0, chars + 2)}...${address.substring(address.length - chars)}`;
}

export function formatUSDC(amount: bigint | number, decimals = 6): string {
  const num = typeof amount === "bigint" ? Number(amount) / 10 ** decimals : amount;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

export function formatUSDCRaw(amount: bigint, decimals = 6): number {
  return Number(amount) / 10 ** decimals;
}

export function parseUSDC(amount: string | number): bigint {
  return BigInt(Math.floor(Number(amount) * 1e6));
}

export function formatPAS(amount: bigint): string {
  const formatted = Number(amount) / 10 ** 10;
  return `${formatted.toFixed(4)} PAS`;
}

export function timeAgo(timestamp: number | bigint): string {
  const ts = typeof timestamp === "bigint" ? Number(timestamp) : timestamp;
  if (ts === 0) return "—";
  return formatDistanceToNow(new Date(ts * 1000), { addSuffix: true });
}

export function getStatusColor(status: number): string {
  switch (status) {
    case 0: return "text-blue-400 bg-blue-400/10 border-blue-400/20";
    case 1: return "text-emerald-400 bg-emerald-400/10 border-emerald-400/20";
    case 2: return "text-gray-400 bg-gray-400/10 border-gray-400/20";
    case 3: return "text-red-400 bg-red-400/10 border-red-400/20";
    case 4: return "text-orange-400 bg-orange-400/10 border-orange-400/20";
    default: return "text-gray-400 bg-gray-400/10 border-gray-400/20";
  }
}

export function getStatusLabel(status: number): string {
  switch (status) {
    case 0: return "Active";
    case 1: return "Released";
    case 2: return "Refunded";
    case 3: return "Disputed";
    case 4: return "Liquidated";
    default: return "Unknown";
  }
}

export function getRailLabel(rail: number): string {
  switch (rail) {
    case 0: return "Direct USDC";
    case 1: return "Yield Enabled";
    case 2: return "Fiat Rails";
    default: return "Unknown";
  }
}

export const EXPLORER_URL = "https://blockscout-testnet.polkadot.io";

export function explorerLink(type: "address" | "tx", hash: string): string {
  return `${EXPLORER_URL}/${type}/${hash}`;
}
