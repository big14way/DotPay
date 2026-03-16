"use client";

import { useState, useEffect } from "react";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { CONTRACTS } from "@/config/contracts";
import { USDC_ABI } from "@/config/abis";
import { txSubmittedToast, txSuccessToast, txErrorToast } from "@/lib/toast";

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

  const { isLoading: isWaiting, isSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  useEffect(() => {
    if (isSuccess && txHash) {
      txSuccessToast(txHash, "USDC approved");
      refetchAllowance();
    }
  }, [isSuccess, txHash]);

  const needsApproval =
    allowance !== undefined && (allowance as bigint) < amount;

  const approve = async () => {
    try {
      const hash = await writeContractAsync({
        address: CONTRACTS.USDC,
        abi: USDC_ABI,
        functionName: "approve",
        args: [spender, amount],
      });
      setTxHash(hash);
      txSubmittedToast(hash, "USDC approval");
      return hash;
    } catch (err: any) {
      txErrorToast(err);
      throw err;
    }
  };

  return {
    allowance: allowance as bigint | undefined,
    needsApproval,
    approve,
    isApproving: isApproving || isWaiting,
    refetchAllowance,
  };
}
