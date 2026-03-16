"use client";

import { useAccount, useReadContract } from "wagmi";
import { CONTRACTS } from "@/config/contracts";
import { ORACLE_ABI } from "@/config/abis";

export function useCompliance() {
  const { address } = useAccount();

  const { data: kycLevel, refetch: refetchKyc } = useReadContract({
    address: CONTRACTS.ComplianceOracle,
    abi: ORACLE_ABI,
    functionName: "kycLevel",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const { data: isBlacklisted } = useReadContract({
    address: CONTRACTS.ComplianceOracle,
    abi: ORACLE_ABI,
    functionName: "blacklisted",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const kycLevelNumber = kycLevel !== undefined ? Number(kycLevel) : 0;

  const { data: txLimit } = useReadContract({
    address: CONTRACTS.ComplianceOracle,
    abi: ORACLE_ABI,
    functionName: "txLimit",
    args: [kycLevelNumber],
    query: { enabled: kycLevelNumber > 0 },
  });

  const getKycLabel = (level: number) => {
    switch (level) {
      case 0:
        return "None";
      case 1:
        return "Basic";
      case 2:
        return "Enhanced";
      case 3:
        return "Full";
      default:
        return "Unknown";
    }
  };

  return {
    kycLevel: kycLevelNumber,
    kycLabel: getKycLabel(kycLevelNumber),
    isBlacklisted: isBlacklisted as boolean | undefined,
    txLimit: txLimit as bigint | undefined,
    refetchKyc,
  };
}
