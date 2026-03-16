"use client";

import { useState } from "react";
import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { CONTRACTS } from "@/config/contracts";
import { INVOICE_CORE_ABI } from "@/config/abis";
import toast from "react-hot-toast";

export function useReleaseEscrow() {
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();
  const { writeContractAsync, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } =
    useWaitForTransactionReceipt({ hash: txHash });

  const release = async (escrowId: bigint) => {
    try {
      const hash = await writeContractAsync({
        address: CONTRACTS.InvoiceCore,
        abi: INVOICE_CORE_ABI,
        functionName: "releaseEscrow",
        args: [escrowId],
      });
      setTxHash(hash);
      toast.success("Release submitted!");
      return hash;
    } catch (err: any) {
      toast.error(err?.shortMessage || "Failed to release escrow");
      throw err;
    }
  };

  const refund = async (escrowId: bigint) => {
    try {
      const hash = await writeContractAsync({
        address: CONTRACTS.InvoiceCore,
        abi: INVOICE_CORE_ABI,
        functionName: "refundEscrow",
        args: [escrowId],
      });
      setTxHash(hash);
      toast.success("Refund submitted!");
      return hash;
    } catch (err: any) {
      toast.error(err?.shortMessage || "Failed to refund escrow");
      throw err;
    }
  };

  const dispute = async (escrowId: bigint) => {
    try {
      const hash = await writeContractAsync({
        address: CONTRACTS.InvoiceCore,
        abi: INVOICE_CORE_ABI,
        functionName: "disputeEscrow",
        args: [escrowId],
      });
      setTxHash(hash);
      toast.success("Dispute submitted!");
      return hash;
    } catch (err: any) {
      toast.error(err?.shortMessage || "Failed to dispute escrow");
      throw err;
    }
  };

  return {
    release,
    refund,
    dispute,
    isPending,
    isConfirming,
    isSuccess,
    txHash,
  };
}
