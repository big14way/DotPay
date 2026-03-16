import { defineChain } from "viem";

export const passetHub = defineChain({
  id: 420420422,
  name: "Paseo Asset Hub",
  nativeCurrency: {
    name: "PAS",
    symbol: "PAS",
    decimals: 10,
  },
  rpcUrls: {
    default: {
      http: ["https://testnet-passet-hub-eth-rpc.polkadot.io"],
    },
  },
  blockExplorers: {
    default: {
      name: "Blockscout",
      url: "https://blockscout-passet-hub.parity-testnet.parity.io",
    },
  },
  testnet: true,
});

export const NETWORK_CONSTANTS = {
  CHAIN_ID: 420420422,
  EVM_RPC: "https://testnet-passet-hub-eth-rpc.polkadot.io",
  EXPLORER: "https://blockscout-passet-hub.parity-testnet.parity.io",
  NATIVE_TOKEN: "PAS",
  NATIVE_DECIMALS: 10,
  FAUCET: "https://faucet.polkadot.io/?parachain=1111",

  USDC_ASSET_ID: 1337,
  USDT_ASSET_ID: 1984,
  USDC_ERC20_ADDR: "0x0000053900000000000000000000000001200000" as `0x${string}`,
  USDT_ERC20_ADDR: "0x000007C000000000000000000000000001200000" as `0x${string}`,

  XCM_PRECOMPILE: "0x00000000000000000000000000000000000a0000" as `0x${string}`,
  HYDRATION_PARA_ID: 2034,
  PENDULUM_PARA_ID: 2094,
} as const;
