import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { passetHub } from "./chains";

export const config = getDefaultConfig({
  appName: "DotPay",
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "demo",
  chains: [passetHub],
  ssr: true,
});
