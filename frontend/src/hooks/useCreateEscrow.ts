"use client";

import { useState, useEffect } from "react";
import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { CONTRACTS } from "@/config/contracts";
import { ESCROW_CORE_ABI } from "@/config/abis";
import { parseUSDC } from "@/lib/utils";
import { txSubmittedToast, txSuccessToast, txErrorToast } from "@/lib/toast";
import { toHex } from "viem";

export function useCreateEscrow() {
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();

  const { writeContractAsync, isPending } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } =
    useWaitForTransactionReceipt({ hash: txHash });

  useEffect(() => {
    if (isSuccess && txHash) {
      txSuccessToast(txHash, "Escrow created");
    }
  }, [isSuccess, txHash]);

  const createEscrow = async ({
    seller,
    amount,
    deadline,
    yieldEnabled,
    rail,
    description,
  }: {
    seller: `0x${string}`;
    amount: string;
    deadline: number;
    yieldEnabled: boolean;
    rail: number;
    description: string;
  }) => {
    try {
      const amountParsed = parseUSDC(amount);
      const descBytes = toHex(description.slice(0, 32).padEnd(32, "\0"), { size: 32 });

      const hash = await writeContractAsync({
        address: CONTRACTS.EscrowCore,
        abi: ESCROW_CORE_ABI,
        functionName: "createEscrow",
        args: [
          seller,
          amountParsed,
          BigInt(deadline),
          yieldEnabled,
          rail,
          descBytes,
        ],
      });

      setTxHash(hash);
      txSubmittedToast(hash, "Escrow creation");
      return hash;
    } catch (err: any) {
      txErrorToast(err);
      throw err;
    }
  };

  return {
    createEscrow,
    isPending,
    isConfirming,
    isSuccess,
    txHash,
  };
}
