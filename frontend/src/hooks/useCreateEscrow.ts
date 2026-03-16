"use client";

import { useState } from "react";
import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { CONTRACTS } from "@/config/contracts";
import { INVOICE_CORE_ABI } from "@/config/abis";
import { parseUSDC } from "@/lib/utils";
import toast from "react-hot-toast";
import { encodePacked, keccak256, toHex } from "viem";

export function useCreateEscrow() {
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();

  const { writeContractAsync, isPending } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } =
    useWaitForTransactionReceipt({ hash: txHash });

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
        address: CONTRACTS.InvoiceCore,
        abi: INVOICE_CORE_ABI,
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
      toast.success("Escrow creation submitted!");
      return hash;
    } catch (err: any) {
      toast.error(err?.shortMessage || "Failed to create escrow");
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
