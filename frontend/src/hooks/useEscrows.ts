"use client";

import { useAccount, useReadContract, useReadContracts } from "wagmi";
import { CONTRACTS } from "@/config/contracts";
import { INVOICE_CORE_ABI } from "@/config/abis";
import { useMemo } from "react";
import type { EscrowData } from "@/components/EscrowCard";

export function useEscrows() {
  const { address } = useAccount();

  const { data: nextId, refetch: refetchNextId } = useReadContract({
    address: CONTRACTS.InvoiceCore,
    abi: INVOICE_CORE_ABI,
    functionName: "nextEscrowId",
  });

  const escrowCount = nextId ? Number(nextId as bigint) : 0;

  const escrowCalls = useMemo(() => {
    if (escrowCount === 0) return [];
    return Array.from({ length: escrowCount }, (_, i) => ({
      address: CONTRACTS.InvoiceCore as `0x${string}`,
      abi: INVOICE_CORE_ABI,
      functionName: "getEscrow" as const,
      args: [BigInt(i)] as const,
    }));
  }, [escrowCount]);

  const { data: escrowResults, refetch: refetchEscrows } = useReadContracts({
    contracts: escrowCalls,
    query: { enabled: escrowCount > 0 },
  });

  const allEscrows: EscrowData[] = useMemo(() => {
    if (!escrowResults) return [];
    return escrowResults
      .filter((r) => r.status === "success" && r.result)
      .map((r) => {
        const e = r.result as any;
        return {
          id: e.id ?? e[0],
          buyer: e.buyer ?? e[1],
          seller: e.seller ?? e[2],
          amount: e.amount ?? e[3],
          yieldAccrued: e.yieldAccrued ?? e[4],
          createdAt: e.createdAt ?? e[5],
          releasedAt: e.releasedAt ?? e[6],
          deadline: e.deadline ?? e[7],
          status: Number(e.status ?? e[8]),
          rail: Number(e.rail ?? e[9]),
          yieldEnabled: e.yieldEnabled ?? e[10],
          nftTokenId: e.nftTokenId ?? e[11],
          description: e.description ?? e[12],
        } as EscrowData;
      });
  }, [escrowResults]);

  const myEscrows = useMemo(() => {
    if (!address) return [];
    const addr = address.toLowerCase();
    return allEscrows.filter(
      (e) =>
        e.buyer.toLowerCase() === addr || e.seller.toLowerCase() === addr
    );
  }, [allEscrows, address]);

  const refetch = () => {
    refetchNextId();
    refetchEscrows();
  };

  return { allEscrows, myEscrows, escrowCount, refetch };
}

export function useEscrow(id: bigint) {
  const { data, isLoading, refetch } = useReadContract({
    address: CONTRACTS.InvoiceCore,
    abi: INVOICE_CORE_ABI,
    functionName: "getEscrow",
    args: [id],
  });

  const escrow = useMemo(() => {
    if (!data) return null;
    const e = data as any;
    return {
      id: e.id ?? e[0],
      buyer: e.buyer ?? e[1],
      seller: e.seller ?? e[2],
      amount: e.amount ?? e[3],
      yieldAccrued: e.yieldAccrued ?? e[4],
      createdAt: e.createdAt ?? e[5],
      releasedAt: e.releasedAt ?? e[6],
      deadline: e.deadline ?? e[7],
      status: Number(e.status ?? e[8]),
      rail: Number(e.rail ?? e[9]),
      yieldEnabled: e.yieldEnabled ?? e[10],
      nftTokenId: e.nftTokenId ?? e[11],
      description: e.description ?? e[12],
    } as EscrowData;
  }, [data]);

  return { escrow, isLoading, refetch };
}
