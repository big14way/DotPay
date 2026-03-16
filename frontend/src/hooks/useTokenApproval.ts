"use client";

import { useState } from "react";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { CONTRACTS } from "@/config/contracts";
import { USDC_ABI } from "@/config/abis";

export function useTokenApproval(spender: `0x${string}`, amount: bigint) {
  const { address } = useAccount();
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: CONTRACTS.USDC,
    abi: USDC_ABI,
    functionName: "allowance",
    args: address ? [address, spender] : undefined,
    query: { enabled: !!address },
  });

  const { writeContractAsync, isPending: isApproving } = useWriteContract();

  const { isLoading: isWaiting } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  const needsApproval =
    allowance !== undefined && (allowance as bigint) < amount;

  const approve = async () => {
    const hash = await writeContractAsync({
      address: CONTRACTS.USDC,
      abi: USDC_ABI,
      functionName: "approve",
      args: [spender, amount],
    });
    setTxHash(hash);
    await refetchAllowance();
    return hash;
  };

  return {
    allowance: allowance as bigint | undefined,
    needsApproval,
    approve,
    isApproving: isApproving || isWaiting,
    refetchAllowance,
  };
}
