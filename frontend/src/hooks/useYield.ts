"use client";

import { useReadContract } from "wagmi";
import { CONTRACTS } from "@/config/contracts";
import { ESCROW_CORE_ABI, YIELD_VAULT_ABI } from "@/config/abis";

export function useYield(escrowId?: bigint) {
  const { data: previewYield, refetch: refetchYield } = useReadContract({
    address: CONTRACTS.EscrowCore,
    abi: ESCROW_CORE_ABI,
    functionName: "previewYield",
    args: escrowId !== undefined ? [escrowId] : undefined,
    query: { enabled: escrowId !== undefined },
  });

  const { data: borrowLimit } = useReadContract({
    address: CONTRACTS.EscrowCore,
    abi: ESCROW_CORE_ABI,
    functionName: "getBorrowLimit",
    args: escrowId !== undefined ? [escrowId] : undefined,
    query: { enabled: escrowId !== undefined },
  });

  const { data: debt } = useReadContract({
    address: CONTRACTS.EscrowCore,
    abi: ESCROW_CORE_ABI,
    functionName: "getDebt",
    args: escrowId !== undefined ? [escrowId] : undefined,
    query: { enabled: escrowId !== undefined },
  });

  return {
    yieldAccrued: previewYield as bigint | undefined,
    borrowLimit: borrowLimit as bigint | undefined,
    debt: debt as bigint | undefined,
    refetchYield,
  };
}

export function useVaultStats() {
  const { data: apy } = useReadContract({
    address: CONTRACTS.XCMYieldVault,
    abi: YIELD_VAULT_ABI,
    functionName: "simulatedApyBps",
  });

  const { data: usdcBalance } = useReadContract({
    address: CONTRACTS.USDC,
    abi: [{
      inputs: [{ internalType: "address", name: "account", type: "address" }],
      name: "balanceOf",
      outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
      stateMutability: "view",
      type: "function",
    }] as const,
    functionName: "balanceOf",
    args: [CONTRACTS.XCMYieldVault],
  });

  return {
    totalDeposits: usdcBalance as bigint | undefined,
    apyBps: apy ? Number(apy as bigint) : 500,
  };
}
