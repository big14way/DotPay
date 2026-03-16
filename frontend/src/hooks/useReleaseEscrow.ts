"use client";

import { useState, useEffect } from "react";
import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { CONTRACTS } from "@/config/contracts";
import { INVOICE_CORE_ABI } from "@/config/abis";
import { txSubmittedToast, txSuccessToast, txErrorToast } from "@/lib/toast";

export function useReleaseEscrow() {
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();
  const [actionLabel, setActionLabel] = useState("Transaction");
  const { writeContractAsync, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } =
    useWaitForTransactionReceipt({ hash: txHash });

  useEffect(() => {
    if (isSuccess && txHash) {
      txSuccessToast(txHash, actionLabel);
    }
  }, [isSuccess, txHash, actionLabel]);

  const release = async (escrowId: bigint) => {
    try {
      setActionLabel("Release");
      const hash = await writeContractAsync({
        address: CONTRACTS.InvoiceCore,
        abi: INVOICE_CORE_ABI,
        functionName: "releaseEscrow",
        args: [escrowId],
      });
      setTxHash(hash);
      txSubmittedToast(hash, "Release escrow");
      return hash;
    } catch (err: any) {
      txErrorToast(err);
      throw err;
    }
  };

  const refund = async (escrowId: bigint) => {
    try {
      setActionLabel("Refund");
      const hash = await writeContractAsync({
        address: CONTRACTS.InvoiceCore,
        abi: INVOICE_CORE_ABI,
        functionName: "refundEscrow",
        args: [escrowId],
      });
      setTxHash(hash);
      txSubmittedToast(hash, "Refund escrow");
      return hash;
    } catch (err: any) {
      txErrorToast(err);
      throw err;
    }
  };

  const dispute = async (escrowId: bigint) => {
    try {
      setActionLabel("Dispute");
      const hash = await writeContractAsync({
        address: CONTRACTS.InvoiceCore,
        abi: INVOICE_CORE_ABI,
        functionName: "disputeEscrow",
        args: [escrowId],
      });
      setTxHash(hash);
      txSubmittedToast(hash, "Dispute escrow");
      return hash;
    } catch (err: any) {
      txErrorToast(err);
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
