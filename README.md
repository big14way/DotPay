# DotPay

Blockchain-native PayPal equivalent built on Polkadot Hub (Paseo Asset Hub testnet). DotPay solves African trade and invoice finance with USDC escrows, invoice NFTs, cross-chain yield via Hydration, working capital lending, and fiat settlement to African rails (NGN, KES, GHS) via Pendulum's Spacewalk bridge.

## Architecture

- **contracts/** — Solidity smart contracts compiled with `@parity/hardhat-polkadot` for PolkaVM
- **frontend/** — Next.js 14 + Tailwind CSS + Wagmi + RainbowKit

## Network

| Parameter | Value |
|-----------|-------|
| Chain ID | 420420422 |
| RPC | https://testnet-passet-hub-eth-rpc.polkadot.io |
| Explorer | https://blockscout-passet-hub.parity-testnet.parity.io |
| Native Token | PAS (decimals: 10) |
| Faucet | https://faucet.polkadot.io/?parachain=1111 |

## Quick Start

### Contracts

```bash
cd contracts
npm install
cp .env.example .env
# Add your private key to .env
npm run compile
npm run test
```

### Frontend

```bash
cd frontend
npm install
cp .env.local.example .env.local
# Add your WalletConnect project ID
npm run dev
```

## Asset Addresses

| Asset | Asset ID | ERC-20 Address |
|-------|----------|----------------|
| USDC | 1337 | 0x0000053900000000000000000000000001200000 |
| USDT | 1984 | 0x000007C000000000000000000000000001200000 |

## Key Precompiles

| Precompile | Address |
|------------|---------|
| XCM | 0x00000000000000000000000000000000000a0000 |

## Parachain IDs

| Chain | Para ID |
|-------|---------|
| Hydration | 2034 |
| Pendulum | 2094 |
