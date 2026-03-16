# DotPay

**Blockchain-native payments infrastructure for African trade and invoice finance, built on Polkadot.**

Africa's $1.2 trillion annual intra-continental trade is strangled by broken payment rails. A Nigerian exporter shipping cashews to Kenya waits 14–45 days for payment clearance. The correspondent banking chain eats 6–12% in fees. Small businesses can't access working capital while funds sit frozen in transit. An estimated $5 billion in trade finance is rejected annually across Sub-Saharan Africa because traditional banks deem the deals "too small" or "too risky." Meanwhile, African currencies (NGN, KES, GHS) suffer chronic volatility — a merchant receiving payment in 30 days may find it worth 15% less by settlement.

DotPay eliminates these pain points by replacing the entire correspondent banking stack with a single Solidity contract on Polkadot Hub. Buyers lock USDC in trustless escrow. The locked funds earn yield on Hydration DEX via XCM cross-chain messaging — turning idle payment float into productive capital. Invoice NFTs make receivables tradeable, so sellers don't wait — they sell the invoice at a small discount and get paid today. When the escrow releases, settlement flows directly to African fiat rails (NGN, KES, GHS) via Pendulum's Spacewalk bridge and Stellar anchors. No correspondent banks. No 45-day waits. No 12% fees.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        DotPay Frontend                              │
│              Next.js 14 + Wagmi v2 + RainbowKit                     │
│    Dashboard │ Send │ Escrows │ Market │ Yield │ Profile            │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ EVM JSON-RPC
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Polkadot Hub (Paseo Testnet)                      │
│                       Chain ID: 420420417                            │
│  ┌──────────────────────────────────┐ ┌────────────────────────────┐│
│  │          EscrowCore.sol          │ │    InvoiceMarket.sol       ││
│  │  createEscrow │ releaseEscrow    │ │  listInvoice │ buyInvoice  ││
│  │  refundEscrow │ disputeEscrow    │ │  borrowAgainstEscrow       ││
│  │  setFiatDetails │ previewYield   │ │  repayBorrow │ getListing  ││
│  └──────┬──────────────┬──────────────┬─────────────┬────────────┘  │
│         │              │              │             │                │
│  ┌──────▼──────┐ ┌─────▼──────┐ ┌────▼─────┐ ┌────▼──────────┐    │
│  │ InvoiceNFT  │ │ Compliance │ │ XCMYield │ │    Fiat       │    │
│  │  (ERC-721)  │ │   Oracle   │ │  Vault   │ │ Settlement    │    │
│  │ Tokenized   │ │  KYC/AML   │ │ Hydration│ │ Pendulum/     │    │
│  │ Invoices    │ │  Limits    │ │ Routing  │ │ Spacewalk     │    │
│  └─────────────┘ └────────────┘ └────┬─────┘ └──────┬────────┘    │
│                                      │               │              │
└──────────────────────────────────────┼───────────────┼──────────────┘
                                       │               │
                          XCM Message  │               │  XCM Message
                                       ▼               ▼
                              ┌─────────────┐  ┌──────────────┐
                              │  Hydration   │  │  Pendulum    │
                              │  (Para 2034) │  │  (Para 2094) │
                              │  DEX Yield   │  │  Spacewalk   │
                              │  5% APY      │  │  Bridge      │
                              └──────────────┘  └──────┬───────┘
                                                       │
                                                       ▼
                                               ┌──────────────┐
                                               │   Stellar    │
                                               │   Anchors    │
                                               │  NGN│KES│GHS │
                                               └──────────────┘
```

---

## The African Trade Problem

| Problem | Impact | DotPay Solution |
|---------|--------|-----------------|
| **Payment delays** — 14-45 days for cross-border settlement | Exporters can't reinvest; working capital dies in transit | USDC escrow with instant on-chain release |
| **High fees** — 6-12% via correspondent banking chains | $4.5B lost annually to intermediary fees across Africa | 0.5% platform fee, no intermediaries |
| **No trade finance** — 80% of African SME trade finance applications rejected | $5B trade finance gap in Sub-Saharan Africa | Invoice NFT marketplace — sell receivables instantly at discount |
| **Currency volatility** — NGN lost 70% vs USD in 2023-2024 | Merchants lose value while waiting for settlement | USDC-denominated escrow preserves value; settle to fiat only at release |
| **Dead capital** — funds locked in transit earn nothing | Opportunity cost of idle payment float | 5% APY yield on escrowed USDC via Hydration DEX |
| **No transparency** — buyers/sellers dispute payments with no proof | $2B+ in annual trade disputes across Africa | On-chain escrow with immutable audit trail and dispute resolution |

---

## Polkadot-Native Features

| Feature | How It Works | Why Polkadot |
|---------|-------------|--------------|
| **XCM Yield Routing** | Escrowed USDC routes to Hydration DEX for 5% APY via XCM messages | Native cross-chain messaging — no bridge trust assumptions |
| **Fiat Off-Ramp** | Settlement to NGN/KES/GHS via Pendulum's Spacewalk bridge to Stellar anchors | Polkadot parachain handles fiat bridge natively |
| **Native Stablecoins** | USDC/USDT are native assets on Asset Hub (not wrapped) | No wrapped token risk — real assets, not IOUs |
| **Shared Security** | All parachains (Hub, Hydration, Pendulum) share Polkadot relay chain security | One security model protects the entire payment flow |
| **Invoice NFTs** | ERC-721 tokens representing receivables, tradeable on marketplace | Single Solidity contract orchestrates multi-chain DeFi |
| **Compliance Oracle** | On-chain KYC/AML with tiered transaction limits | Regulatory-ready from day one for African jurisdictions |

---

## Deployed Contract Addresses (Polkadot Hub Testnet)

| Contract | Address |
|----------|---------|
| **EscrowCore** | `0x4d88c574A9D573a5C62C692e4714F61829d7E4a6` |
| **InvoiceMarket** | `0x6997d539bC80f514e7B015545E22f3Db5672a5f8` |
| **InvoiceNFT** | `0x8486E62b5975A4241818b564834A5f51ae2540B6` |
| **MockUSDC** | `0xC3a201c2Dc904ae32a9a0adea3478EB252d5Cf88` |
| **ComplianceOracle** | `0xde5eCbdf2e9601C4B4a08899EAa836081011F7ac` |
| **XCMYieldVault** | `0x9C7af8B9e41555ce384a67f563Fa0d20D1dD9DFc` |
| **FiatSettlement** | `0xd8E68c3B9D3637CB99054efEdeE20BD8aeea45f1` |

**Deployer:** `0x208B2660e5F62CDca21869b389c5aF9E7f0faE89`

---

## Network Configuration

| Parameter | Value |
|-----------|-------|
| **Network** | Polkadot Hub Testnet (Paseo) |
| **Chain ID** | `420420417` |
| **RPC** | `https://eth-rpc-testnet.polkadot.io` |
| **Explorer** | `https://blockscout-testnet.polkadot.io` |
| **Native Token** | PAS (10 decimals on Substrate, 18 on EVM) |
| **Faucet** | `https://faucet.polkadot.io/` |

### Key Precompiles & Parachain IDs

| Resource | Identifier |
|----------|-----------|
| XCM Precompile | `0x00000000000000000000000000000000000a0000` |
| Hydration Para ID | `2034` |
| Pendulum Para ID | `2094` |
| USDC Asset ID | `1337` |
| USDT Asset ID | `1984` |

---

## Local Setup

### Prerequisites

- Node.js 18+
- npm or yarn
- A wallet with testnet PAS tokens (see "Getting Testnet Tokens" below)

### 1. Clone the repository

```bash
git clone https://github.com/big14way/DotPay.git
cd DotPay
```

### 2. Set up smart contracts

```bash
cd contracts
npm install
```

Create a `.env` file:

```bash
PRIVATE_KEY=your_wallet_private_key_here
DEPLOYER_ADDRESS=your_wallet_address_here
```

Compile and test:

```bash
npx hardhat compile          # Compile with resolc (PolkaVM)
npx hardhat test             # Run 157 tests (local Hardhat network)
```

Deploy to Polkadot Hub Testnet:

```bash
npx hardhat run scripts/deploy.js --network passetHub
```

### 3. Set up frontend

```bash
cd ../frontend
npm install
```

Create environment file:

```bash
cp .env.local.example .env.local
```

The `.env.local.example` comes pre-filled with deployed contract addresses and a WalletConnect project ID. Edit if you redeployed contracts.

Start the dev server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 4. Connect your wallet

1. Open the app and click "Connect Wallet"
2. Add the Polkadot Hub Testnet network to MetaMask:
   - **Network Name:** Polkadot Hub Testnet
   - **RPC URL:** `https://eth-rpc-testnet.polkadot.io`
   - **Chain ID:** `420420417`
   - **Currency Symbol:** `PAS`
   - **Explorer:** `https://blockscout-testnet.polkadot.io`
3. Your wallet should auto-detect the network via RainbowKit

---

## Getting Testnet Tokens

### PAS (gas token)

1. Visit the [Polkadot Faucet](https://faucet.polkadot.io/)
2. Select **Paseo** relay chain or **Asset Hub**
3. Enter your **Substrate address** (SS58 format)
4. Note: Your EVM address and Substrate address are mapped — PAS received on the Substrate side is accessible from EVM

### Mock USDC (for testing)

The deployed MockUSDC contract has a public `faucet()` function:

```solidity
// Call faucet() to mint 10,000 USDC to your address
// MockUSDC address: 0xC3a201c2Dc904ae32a9a0adea3478EB252d5Cf88
```

You can call this from the Blockscout explorer's "Write Contract" tab, or from the browser console using the app's contract integration.

---

## How It Works: End-to-End Flow

### 1. Create Escrow
A Nigerian buyer wants to pay a Kenyan seller $5,000 for goods. The buyer creates an escrow on DotPay, locking 5,000 USDC with a 30-day deadline and yield enabled.

### 2. Yield Accrues
The locked USDC is routed to Hydration DEX via XCM, earning 5% APY. On a $5,000 escrow held for 30 days, that's ~$20.55 in yield — split 80% buyer / 15% seller / 5% platform.

### 3. Invoice NFT Minted
An ERC-721 NFT is minted representing the $5,000 receivable. The seller can hold it, or list it on the DotPay marketplace.

### 4. Invoice Factoring (Optional)
If the seller needs cash immediately, they list the invoice NFT at a 5-10% discount. A factoring investor buys it for $4,500-$4,750 and receives the full $5,000 when the escrow releases.

### 5. Borrow Against Escrow (Optional)
The seller can borrow up to 80% LTV against the escrow — $4,000 in working capital — without selling the invoice.

### 6. Release & Settlement
The buyer confirms goods received and releases the escrow. Funds + yield flow to the seller. If fiat rails are selected, USDC converts to NGN/KES/GHS via Pendulum's Spacewalk bridge and Stellar anchors.

### 7. Dispute Resolution
If there's a disagreement, either party can dispute. The contract owner (DAO in production) resolves the dispute.

---

## Africa Use Case: Real-World Scenarios

### Scenario 1: Lagos Textile Exporter
**Adunni** exports African wax prints from Lagos to Accra. Her Ghanaian buyer previously paid via Western Union (7.5% fees, 5-day clearance). With DotPay:
- Buyer locks $12,000 USDC in escrow (0.5% fee = $60 vs $900 via WU)
- Adunni sees funds locked on-chain instantly — ships with confidence
- Yield accrues at 5% APY while goods are in transit (14 days = ~$23)
- On delivery confirmation, funds release to Adunni's GHS account via Pendulum
- **Total savings: $840 per transaction. Settlement: instant vs 5 days.**

### Scenario 2: Nairobi Coffee Cooperative
**Kahawa Co-op** sells specialty coffee to buyers in South Africa. They typically wait 45 days for payment and can't afford to buy next season's beans.
- SA buyer creates $25,000 escrow with 45-day deadline
- Kahawa lists the invoice NFT on marketplace at 8% discount ($23,000)
- A DeFi investor buys the NFT, giving Kahawa immediate working capital
- 45 days later, investor receives the full $25,000 + yield (~$154)
- **Kahawa gets paid Day 1 instead of Day 45. Investor earns 15.8% annualized.**

### Scenario 3: Mombasa Freight Forwarder
**Musa** runs a freight forwarding company. He needs to pay port fees while waiting for client payments.
- Client's $8,000 escrow is active with 80% LTV borrowing
- Musa borrows $6,400 against the escrow to pay port fees
- When the escrow releases, the loan is automatically repaid
- **No bank loan application. No credit check. Instant working capital.**

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Smart Contracts** | Solidity 0.8.26, OpenZeppelin 5.x, Hardhat |
| **Compiler** | resolc (PolkaVM target via `@parity/hardhat-polkadot`) |
| **Blockchain** | Polkadot Hub (Paseo Testnet), Chain ID 420420417 |
| **Frontend** | Next.js 14 (App Router), TypeScript, Tailwind CSS |
| **Web3** | Wagmi v2, viem, RainbowKit |
| **Cross-Chain** | XCM precompile (`0x...0a0000`) for Hydration & Pendulum |
| **Testing** | 157 passing tests (Hardhat + Chai) |

---

## Project Structure

```
DotPay/
├── contracts/
│   ├── src/
│   │   ├── interfaces/          # IDotPay.sol, IComplianceOracle.sol, IERC20Minimal.sol
│   │   ├── mocks/               # MockUSDC.sol (6 decimals)
│   │   ├── EscrowCore.sol       # Core escrow lifecycle (create, release, refund)
│   │   ├── InvoiceMarket.sol    # Invoice marketplace & borrowing
│   │   ├── InvoiceNFT.sol       # ERC-721 for tokenized invoices
│   │   ├── ComplianceOracle.sol # KYC/AML oracle with tiered limits
│   │   ├── XCMYieldVault.sol    # Hydration yield routing via XCM
│   │   └── FiatSettlement.sol   # Pendulum/Spacewalk fiat off-ramp
│   ├── test/                    # 157 comprehensive tests
│   ├── scripts/deploy.js        # Deployment script
│   └── hardhat.config.js        # PolkaVM + resolc configuration
├── frontend/
│   ├── src/
│   │   ├── app/                 # Next.js pages (7 routes)
│   │   ├── components/          # 11 shared UI components
│   │   ├── hooks/               # 8 contract interaction hooks
│   │   ├── config/              # Chain, contracts, ABIs, wagmi
│   │   └── lib/                 # Utility functions
│   └── .env.local.example       # Environment template
└── README.md
```

---

## Smart Contract Details

### EscrowCore.sol — The Heart of DotPay

Manages the full escrow lifecycle, yield routing, and fiat settlement:

| Function | Description |
|----------|-------------|
| `createEscrow()` | Lock USDC with seller address, deadline, yield toggle, settlement rail |
| `releaseEscrow()` | Buyer confirms delivery, funds + yield flow to seller |
| `refundEscrow()` | Buyer reclaims funds (before deadline) |
| `disputeEscrow()` | Either party flags a dispute for resolution |
| `setFiatDetails()` | Set Stellar address and corridor for fiat settlement |
| `previewYield()` | Preview accrued yield for an escrow |

### InvoiceMarket.sol — Invoice Factoring & Borrowing

Handles the secondary market for invoice NFTs and borrowing against escrow:

| Function | Description |
|----------|-------------|
| `listInvoice()` | Seller lists invoice NFT on marketplace at a discount |
| `buyInvoice()` | Investor purchases invoice NFT, becomes release beneficiary |
| `borrowAgainstEscrow()` | Seller borrows up to 80% LTV against active escrow |
| `repayBorrow()` | Repay outstanding debt before release |

**Key Constants:**
- Platform Fee: 0.5% (50 BPS)
- Borrow LTV: 80% (8000 BPS)
- Yield Split: 80% buyer / 15% seller / 5% platform

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## License

MIT

---

*Built for the Polkadot ecosystem. Solving real problems for African trade.*
