"use client";

import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { CONTRACTS } from "@/config/contracts";
import { USDC_ABI, ORACLE_ABI } from "@/config/abis";
import { txSubmittedToast, txSuccessToast, txErrorToast } from "@/lib/toast";

export function useFaucet() {
  const { writeContractAsync, data: hash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const mintUSDC = async () => {
    try {
      const tx = await writeContractAsync({
        address: CONTRACTS.USDC,
        abi: USDC_ABI,
        functionName: "faucet",
      });
      txSubmittedToast(tx, "Mint 10,000 USDC");
      return tx;
    } catch (err) {
      txErrorToast(err);
      throw err;
    }
  };

  return { mintUSDC, isPending, isConfirming, isSuccess, hash };
}

export function useSetKyc() {
  const { writeContractAsync, data: hash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const setKyc = async (address: `0x${string}`, level: number) => {
    try {
      const tx = await writeContractAsync({
        address: CONTRACTS.ComplianceOracle,
        abi: ORACLE_ABI,
        functionName: "setKycLevel",
        args: [address, level],
      });
      txSubmittedToast(tx, "Set KYC Level");
      return tx;
    } catch (err) {
      txErrorToast(err);
      throw err;
    }
  };

  return { setKyc, isPending, isConfirming, isSuccess, hash };
}
