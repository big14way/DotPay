"use client";

import { useAccount, useReadContract, useBalance as useWagmiBalance } from "wagmi";
import { CONTRACTS } from "@/config/contracts";
import { USDC_ABI } from "@/config/abis";

export function useUSDCBalance() {
  const { address } = useAccount();

  const { data: balance, refetch } = useReadContract({
    address: CONTRACTS.USDC,
    abi: USDC_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  return {
    balance: balance as bigint | undefined,
    refetch,
  };
}

export function useNativeBalance() {
  const { address } = useAccount();
  const { data, refetch } = useWagmiBalance({ address });

  return {
    balance: data?.value,
    formatted: data?.formatted,
    symbol: data?.symbol,
    refetch,
  };
}
