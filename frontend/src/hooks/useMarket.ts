"use client";

import { useState, useMemo, useEffect } from "react";
import {
  useReadContract,
  useReadContracts,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { CONTRACTS } from "@/config/contracts";
import { INVOICE_MARKET_ABI } from "@/config/abis";
import { txSubmittedToast, txSuccessToast, txErrorToast } from "@/lib/toast";
import type { ListingData } from "@/components/InvoiceCard";

export function useMarket() {
  const { data: nextListingId } = useReadContract({
    address: CONTRACTS.InvoiceMarket,
    abi: INVOICE_MARKET_ABI,
    functionName: "nextListingId",
  });

  const listingCount = nextListingId ? Number(nextListingId as bigint) : 0;

  const listingCalls = useMemo(() => {
    if (listingCount === 0) return [];
    return Array.from({ length: listingCount }, (_, i) => ({
      address: CONTRACTS.InvoiceMarket as `0x${string}`,
      abi: INVOICE_MARKET_ABI,
      functionName: "getListing" as const,
      args: [BigInt(i)] as const,
    }));
  }, [listingCount]);

  const { data: listingResults, refetch } = useReadContracts({
    contracts: listingCalls,
    query: { enabled: listingCount > 0 },
  });

  const listings: ListingData[] = useMemo(() => {
    if (!listingResults) return [];
    return listingResults
      .filter((r) => r.status === "success" && r.result)
      .map((r, i) => {
        const l = r.result as any;
        return {
          id: BigInt(i),
          escrowId: l.escrowId ?? l[0],
          tokenId: l.tokenId ?? l[1],
          seller: l.seller ?? l[2],
          listPrice: l.listPrice ?? l[3],
          faceValue: l.faceValue ?? l[4],
          active: l.active ?? l[5],
        } as ListingData;
      });
  }, [listingResults]);

  const activeListings = listings.filter((l) => l.active);

  return { listings, activeListings, listingCount, refetch };
}

export function useBuyInvoice() {
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();
  const { writeContractAsync, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } =
    useWaitForTransactionReceipt({ hash: txHash });

  useEffect(() => {
    if (isSuccess && txHash) {
      txSuccessToast(txHash, "Invoice purchased");
    }
  }, [isSuccess, txHash]);

  const buyInvoice = async (listingId: bigint) => {
    try {
      const hash = await writeContractAsync({
        address: CONTRACTS.InvoiceMarket,
        abi: INVOICE_MARKET_ABI,
        functionName: "buyInvoice",
        args: [listingId],
      });
      setTxHash(hash);
      txSubmittedToast(hash, "Invoice purchase");
      return hash;
    } catch (err: any) {
      txErrorToast(err);
      throw err;
    }
  };

  return { buyInvoice, isPending, isConfirming, isSuccess, txHash };
}

export function useListInvoice() {
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();
  const { writeContractAsync, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } =
    useWaitForTransactionReceipt({ hash: txHash });

  useEffect(() => {
    if (isSuccess && txHash) {
      txSuccessToast(txHash, "Invoice listed");
    }
  }, [isSuccess, txHash]);

  const listInvoice = async (escrowId: bigint, listPrice: bigint) => {
    try {
      const hash = await writeContractAsync({
        address: CONTRACTS.InvoiceMarket,
        abi: INVOICE_MARKET_ABI,
        functionName: "listInvoice",
        args: [escrowId, listPrice],
      });
      setTxHash(hash);
      txSubmittedToast(hash, "Invoice listing");
      return hash;
    } catch (err: any) {
      txErrorToast(err);
      throw err;
    }
  };

  return { listInvoice, isPending, isConfirming, isSuccess, txHash };
}
