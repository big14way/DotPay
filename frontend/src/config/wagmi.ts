import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { paseoAssetHub } from "./chains";

export const config = getDefaultConfig({
  appName: "DotPay",
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "1eebe528ca0ce94a99ceaa2e915058d7",
  chains: [paseoAssetHub],
  ssr: true,
});
