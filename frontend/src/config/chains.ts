import { defineChain } from "viem";

export const paseoAssetHub = defineChain({
  id: 420420417,
  name: "Polkadot Hub Testnet",
  nativeCurrency: {
    decimals: 10,
    name: "Paseo",
    symbol: "PAS",
  },
  rpcUrls: {
    default: {
      http: ["https://eth-rpc-testnet.polkadot.io"],
    },
  },
  blockExplorers: {
    default: {
      name: "Blockscout",
      url: "https://blockscout-testnet.polkadot.io",
    },
  },
  testnet: true,
});

export const NETWORK_CONSTANTS = {
  CHAIN_ID: 420420417,
  EVM_RPC: "https://eth-rpc-testnet.polkadot.io",
  EXPLORER: "https://blockscout-testnet.polkadot.io",
  NATIVE_TOKEN: "PAS",
  NATIVE_DECIMALS: 10,
  FAUCET: "https://faucet.polkadot.io/",
  USDC_ASSET_ID: 1337,
  USDT_ASSET_ID: 1984,
  XCM_PRECOMPILE: "0x00000000000000000000000000000000000a0000" as `0x${string}`,
  HYDRATION_PARA_ID: 2034,
  PENDULUM_PARA_ID: 2094,
} as const;
