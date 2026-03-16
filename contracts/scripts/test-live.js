const { ethers } = require("hardhat");

const EXPLORER = "https://blockscout-testnet.polkadot.io";

const CONTRACTS = {
  USDC: "0xC3a201c2Dc904ae32a9a0adea3478EB252d5Cf88",
  InvoiceCore: "0xe3D37E5c036CC0bb4E0A170D49cc9212ABc8f985",
  InvoiceNFT: "0x8486E62b5975A4241818b564834A5f51ae2540B6",
  ComplianceOracle: "0xde5eCbdf2e9601C4B4a08899EAa836081011F7ac",
  XCMYieldVault: "0x9C7af8B9e41555ce384a67f563Fa0d20D1dD9DFc",
  FiatSettlement: "0xd8E68c3B9D3637CB99054efEdeE20BD8aeea45f1",
};

const USDC_ABI = [
  "function faucet() external",
  "function balanceOf(address) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
];

const CORE_ABI = [
  "function createEscrow(address seller, uint256 amount, uint64 deadline, bool yieldEnabled, uint8 rail, bytes32 description) returns (uint256)",
  "function getEscrow(uint256 id) view returns (tuple(uint256 id, address buyer, address seller, uint256 amount, uint256 yieldAccrued, uint64 createdAt, uint64 releasedAt, uint64 deadline, uint8 status, uint8 rail, bool yieldEnabled, uint256 nftTokenId, bytes32 description))",
  "function nextEscrowId() view returns (uint256)",
  "function releaseEscrow(uint256 escrowId)",
  "function previewYield(uint256 escrowId) view returns (uint256)",
  "function getBorrowLimit(uint256 escrowId) view returns (uint256)",
];

const ORACLE_ABI = [
  "function kycLevel(address) view returns (uint8)",
  "function setKycLevel(address user, uint8 level)",
];

const STATUS = ["Active", "Released", "Refunded", "Disputed", "Liquidated"];
const RAIL = ["Direct USDC", "Yield", "Fiat Rails"];

async function main() {
  const provider = ethers.provider;
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  const usdc = new ethers.Contract(CONTRACTS.USDC, USDC_ABI, wallet);
  const core = new ethers.Contract(CONTRACTS.InvoiceCore, CORE_ABI, wallet);
  const oracle = new ethers.Contract(CONTRACTS.ComplianceOracle, ORACLE_ABI, wallet);

  console.log("\n========================================");
  console.log("  DotPay Live Integration Test");
  console.log("========================================\n");
  console.log(`  Wallet:  ${wallet.address}`);
  const pas = await provider.getBalance(wallet.address);
  const usdcBal = await usdc.balanceOf(wallet.address);
  console.log(`  PAS:     ${ethers.formatUnits(pas, 18)}`);
  console.log(`  USDC:    ${ethers.formatUnits(usdcBal, 6)}\n`);

  const sellerAddr = "0x1111111111111111111111111111111111111111";
  const txs = {};

  // ─── 1. Approve USDC ───
  console.log("── 1. Approve 100 USDC for InvoiceCore ──");
  const amount = ethers.parseUnits("100", 6);
  const tx1 = await usdc.approve(CONTRACTS.InvoiceCore, amount);
  txs.approve = tx1.hash;
  console.log(`  TX: ${EXPLORER}/tx/${tx1.hash}`);
  await tx1.wait();
  console.log("  ✅ Approved\n");

  // ─── 2. Create Escrow ───
  console.log("── 2. Create Escrow (100 USDC, no yield) ──");
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 30 * 86400);
  const desc = ethers.encodeBytes32String("Test Invoice #001");
  const tx2 = await core.createEscrow(sellerAddr, amount, deadline, false, 0, desc, { gasLimit: 5000000 });
  txs.create = tx2.hash;
  console.log(`  TX: ${EXPLORER}/tx/${tx2.hash}`);
  await tx2.wait();
  console.log("  ✅ Escrow created\n");

  // ─── 3. Read Escrow ───
  console.log("── 3. Read Escrow On-Chain ──");
  const nextId = await core.nextEscrowId();
  const escrowId = Number(nextId) - 1;
  const e = await core.getEscrow(escrowId);
  console.log(`  ID:      ${escrowId}`);
  console.log(`  Buyer:   ${e.buyer}`);
  console.log(`  Seller:  ${e.seller}`);
  console.log(`  Amount:  ${ethers.formatUnits(e.amount, 6)} USDC`);
  console.log(`  Status:  ${STATUS[Number(e.status)]}`);
  console.log(`  NFT:     #${e.nftTokenId}`);
  console.log(`  Rail:    ${RAIL[Number(e.rail)]}\n`);

  // ─── 4. Release Escrow ───
  console.log("── 4. Release Escrow ──");
  const tx3 = await core.releaseEscrow(escrowId, { gasLimit: 5000000 });
  txs.release = tx3.hash;
  console.log(`  TX: ${EXPLORER}/tx/${tx3.hash}`);
  await tx3.wait();
  console.log("  ✅ Released\n");

  // ─── 5. Verify Final State ───
  console.log("── 5. Verify Final State ──");
  const final = await core.getEscrow(escrowId);
  const finalUsdc = await usdc.balanceOf(wallet.address);
  const finalPas = await provider.getBalance(wallet.address);
  console.log(`  Status:    ${STATUS[Number(final.status)]}`);
  console.log(`  USDC:      ${ethers.formatUnits(finalUsdc, 6)}`);
  console.log(`  PAS:       ${ethers.formatUnits(finalPas, 18)}`);

  // ─── Summary ───
  console.log("\n========================================");
  console.log("  All Transactions — Explorer Links");
  console.log("========================================");
  console.log(`  Approve:  ${EXPLORER}/tx/${txs.approve}`);
  console.log(`  Create:   ${EXPLORER}/tx/${txs.create}`);
  console.log(`  Release:  ${EXPLORER}/tx/${txs.release}`);
  console.log(`  Contract: ${EXPLORER}/address/${CONTRACTS.InvoiceCore}`);
  console.log("\n  ✅ Full escrow lifecycle tested successfully!\n");
}

main().catch((err) => {
  console.error("\n❌ Error:", err.message?.slice(0, 300));
  process.exit(1);
});
