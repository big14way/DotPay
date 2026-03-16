import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function shortenAddress(address: string, chars = 4): string {
  return `${address.substring(0, chars + 2)}...${address.substring(address.length - chars)}`;
}

export function formatUSDC(amount: bigint, decimals = 6): string {
  const formatted = Number(amount) / 10 ** decimals;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(formatted);
}

export function formatPAS(amount: bigint): string {
  const formatted = Number(amount) / 10 ** 10;
  return `${formatted.toFixed(4)} PAS`;
}
