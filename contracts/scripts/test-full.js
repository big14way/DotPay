const { ethers } = require("hardhat");

const EXPLORER = "https://blockscout-testnet.polkadot.io";

const C = {
  USDC:           "0xC3a201c2Dc904ae32a9a0adea3478EB252d5Cf88",
  EscrowCore:     "0x4d88c574A9D573a5C62C692e4714F61829d7E4a6",
  InvoiceMarket:  "0x6997d539bC80f514e7B015545E22f3Db5672a5f8",
  InvoiceNFT:     "0x8486E62b5975A4241818b564834A5f51ae2540B6",
  Oracle:         "0xde5eCbdf2e9601C4B4a08899EAa836081011F7ac",
  YieldVault:     "0x9C7af8B9e41555ce384a67f563Fa0d20D1dD9DFc",
  FiatSettlement: "0xd8E68c3B9D3637CB99054efEdeE20BD8aeea45f1",
};

const STATUS = ["Active", "Released", "Refunded", "Disputed", "Liquidated"];
const RAIL   = ["Direct USDC", "Yield", "Fiat Rails"];
const passed = [];
const failed = [];

function link(type, hash) {
  return `${EXPLORER}/${type}/${hash}`;
}

async function main() {
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, ethers.provider);

  // Contract instances
  const usdc = new ethers.Contract(C.USDC, [
    "function balanceOf(address) view returns (uint256)",
    "function approve(address,uint256) returns (bool)",
    "function allowance(address,address) view returns (uint256)",
    "function faucet() external",
  ], wallet);

  const core = new ethers.Contract(C.EscrowCore, [
    "function createEscrow(address,uint256,uint64,bool,uint8,bytes32) returns (uint256)",
    "function releaseEscrow(uint256)",
    "function refundEscrow(uint256)",
    "function disputeEscrow(uint256)",
    "function getEscrow(uint256) view returns (tuple(uint256 id,address buyer,address seller,uint256 amount,uint256 yieldAccrued,uint64 createdAt,uint64 releasedAt,uint64 deadline,uint8 status,uint8 rail,bool yieldEnabled,uint256 nftTokenId,bytes32 description))",
    "function nextEscrowId() view returns (uint256)",
    "function previewYield(uint256) view returns (uint256)",
    "function getBorrowLimit(uint256) view returns (uint256)",
    "function getDebt(uint256) view returns (uint256)",
    "function paused() view returns (bool)",
    "function owner() view returns (address)",
  ], wallet);

  const market = new ethers.Contract(C.InvoiceMarket, [
    "function nextListingId() view returns (uint256)",
    "function getListing(uint256) view returns (tuple(uint256 escrowId,uint256 tokenId,address seller,uint256 listPrice,uint256 faceValue,bool active))",
    "function listInvoice(uint256,uint256)",
    "function buyInvoice(uint256)",
    "function borrowAgainstEscrow(uint256,uint256)",
    "function repayBorrow(uint256,uint256)",
  ], wallet);

  const oracle = new ethers.Contract(C.Oracle, [
    "function kycLevel(address) view returns (uint8)",
    "function setKycLevel(address,uint8)",
    "function txLimit(uint8) view returns (uint256)",
  ], wallet);

  const nft = new ethers.Contract(C.InvoiceNFT, [
    "function name() view returns (string)",
    "function symbol() view returns (string)",
    "function ownerOf(uint256) view returns (address)",
    "function minter() view returns (address)",
  ], wallet);

  const vault = new ethers.Contract(C.YieldVault, [
    "function simulatedApyBps() view returns (uint256)",
    "function previewYield(uint256) view returns (uint256)",
    "function coreContract() view returns (address)",
  ], wallet);

  const fiat = new ethers.Contract(C.FiatSettlement, [
    "function owner() view returns (address)",
    "function coreContract() view returns (address)",
  ], wallet);

  console.log("\n╔════════════════════════════════════════════════════════╗");
  console.log("║        DotPay — Full On-Chain Integration Test         ║");
  console.log("║     Polkadot Hub Testnet (Chain 420420417)             ║");
  console.log("╚════════════════════════════════════════════════════════╝\n");

  const bal = await ethers.provider.getBalance(wallet.address);
  const usdcBal = await usdc.balanceOf(wallet.address);
  console.log(`  Wallet:  ${wallet.address}`);
  console.log(`  PAS:     ${ethers.formatUnits(bal, 18)}`);
  console.log(`  USDC:    ${ethers.formatUnits(usdcBal, 6)}\n`);

  // ════════════════════════════════════════════════
  // TEST 1: View functions on all 7 contracts
  // ════════════════════════════════════════════════
  console.log("━━━ TEST 1: Contract View Functions ━━━\n");

  try {
    const name = await nft.name();
    const symbol = await nft.symbol();
    const minter = await nft.minter();
    console.log(`  InvoiceNFT:     name="${name}" symbol="${symbol}"`);
    console.log(`                  minter=${minter}`);
    passed.push("InvoiceNFT views");
  } catch(e) { console.log(`  ❌ InvoiceNFT: ${e.message?.slice(0,100)}`); failed.push("InvoiceNFT views"); }

  try {
    const kyc = await oracle.kycLevel(wallet.address);
    const limit = await oracle.txLimit(kyc);
    console.log(`  Oracle:         kycLevel=${kyc} txLimit=${ethers.formatUnits(limit, 6)} USDC`);
    passed.push("Oracle views");
  } catch(e) { console.log(`  ❌ Oracle: ${e.message?.slice(0,100)}`); failed.push("Oracle views"); }

  try {
    const apy = await vault.simulatedApyBps();
    const vaultCore = await vault.coreContract();
    console.log(`  YieldVault:     APY=${Number(apy)/100}% coreContract=${vaultCore}`);
    passed.push("YieldVault views");
  } catch(e) { console.log(`  ❌ YieldVault: ${e.message?.slice(0,100)}`); failed.push("YieldVault views"); }

  try {
    const fiatOwner = await fiat.owner();
    const fiatCore = await fiat.coreContract();
    console.log(`  FiatSettlement: owner=${fiatOwner} core=${fiatCore}`);
    passed.push("FiatSettlement views");
  } catch(e) { console.log(`  ❌ FiatSettlement: ${e.message?.slice(0,100)}`); failed.push("FiatSettlement views"); }

  try {
    const paused = await core.paused();
    const owner = await core.owner();
    const nextId = await core.nextEscrowId();
    console.log(`  EscrowCore:     paused=${paused} owner=${owner} nextEscrowId=${nextId}`);
    passed.push("EscrowCore views");
  } catch(e) { console.log(`  ❌ EscrowCore: ${e.message?.slice(0,100)}`); failed.push("EscrowCore views"); }

  try {
    const nextListing = await market.nextListingId();
    console.log(`  InvoiceMarket:  nextListingId=${nextListing}`);
    passed.push("InvoiceMarket views");
  } catch(e) { console.log(`  ❌ InvoiceMarket: ${e.message?.slice(0,100)}`); failed.push("InvoiceMarket views"); }

  try {
    const usdcBalance = await usdc.balanceOf(wallet.address);
    console.log(`  MockUSDC:       balance=${ethers.formatUnits(usdcBalance, 6)} USDC`);
    passed.push("MockUSDC views");
  } catch(e) { console.log(`  ❌ MockUSDC: ${e.message?.slice(0,100)}`); failed.push("MockUSDC views"); }

  // ════════════════════════════════════════════════
  // TEST 2: Escrow Lifecycle — Create + Release
  // ════════════════════════════════════════════════
  console.log("\n━━━ TEST 2: Create & Release Escrow (Direct USDC) ━━━\n");

  const seller1 = "0x1111111111111111111111111111111111111111";
  const amount1 = ethers.parseUnits("50", 6);

  // Ensure KYC
  const buyerKyc = await oracle.kycLevel(wallet.address);
  if (Number(buyerKyc) < 1) {
    const txk = await oracle.setKycLevel(wallet.address, 2);
    await txk.wait();
    console.log("  Set buyer KYC to Advanced");
  }

  // Approve
  const txApprove1 = await usdc.approve(C.EscrowCore, amount1);
  console.log(`  Approve TX:  ${link("tx", txApprove1.hash)}`);
  await txApprove1.wait();
  console.log("  ✅ Approved 50 USDC");

  // Create
  const deadline1 = BigInt(Math.floor(Date.now()/1000) + 30*86400);
  const desc1 = ethers.encodeBytes32String("Direct escrow #1");
  const txCreate1 = await core.createEscrow(seller1, amount1, deadline1, false, 0, desc1, { gasLimit: 5000000 });
  console.log(`  Create TX:   ${link("tx", txCreate1.hash)}`);
  await txCreate1.wait();
  const escrowId1 = Number(await core.nextEscrowId()) - 1;
  console.log(`  ✅ Escrow #${escrowId1} created`);

  // Read
  const e1 = await core.getEscrow(escrowId1);
  console.log(`  Buyer:   ${e1.buyer}`);
  console.log(`  Seller:  ${e1.seller}`);
  console.log(`  Amount:  ${ethers.formatUnits(e1.amount, 6)} USDC`);
  console.log(`  Status:  ${STATUS[Number(e1.status)]}`);
  console.log(`  Rail:    ${RAIL[Number(e1.rail)]}`);
  console.log(`  NFT #${e1.nftTokenId}`);
  passed.push("Create escrow (Direct)");

  // Release
  const txRelease1 = await core.releaseEscrow(escrowId1, { gasLimit: 5000000 });
  console.log(`  Release TX:  ${link("tx", txRelease1.hash)}`);
  await txRelease1.wait();
  const e1r = await core.getEscrow(escrowId1);
  console.log(`  ✅ Status: ${STATUS[Number(e1r.status)]}`);
  passed.push("Release escrow (Direct)");

  // ════════════════════════════════════════════════
  // TEST 3: Escrow with Yield + Refund
  // ════════════════════════════════════════════════
  console.log("\n━━━ TEST 3: Create Yield Escrow & Refund ━━━\n");

  const amount2 = ethers.parseUnits("75", 6);
  const txApprove2 = await usdc.approve(C.EscrowCore, amount2);
  console.log(`  Approve TX:  ${link("tx", txApprove2.hash)}`);
  await txApprove2.wait();

  const deadline2 = BigInt(Math.floor(Date.now()/1000) + 30*86400);
  const desc2 = ethers.encodeBytes32String("Yield escrow #2");
  const txCreate2 = await core.createEscrow(seller1, amount2, deadline2, true, 1, desc2, { gasLimit: 5000000 });
  console.log(`  Create TX:   ${link("tx", txCreate2.hash)}`);
  await txCreate2.wait();
  const escrowId2 = Number(await core.nextEscrowId()) - 1;
  console.log(`  ✅ Yield Escrow #${escrowId2} created`);

  // Check yield preview
  const yieldPreview = await core.previewYield(escrowId2);
  console.log(`  Yield preview: ${ethers.formatUnits(yieldPreview, 6)} USDC`);
  passed.push("Create escrow (Yield)");

  // Check borrow limit
  const borrowLimit = await core.getBorrowLimit(escrowId2);
  console.log(`  Borrow limit:  ${ethers.formatUnits(borrowLimit, 6)} USDC (80% LTV)`);
  passed.push("getBorrowLimit");

  // Refund
  const txRefund = await core.refundEscrow(escrowId2, { gasLimit: 5000000 });
  console.log(`  Refund TX:   ${link("tx", txRefund.hash)}`);
  await txRefund.wait();
  const e2r = await core.getEscrow(escrowId2);
  console.log(`  ✅ Status: ${STATUS[Number(e2r.status)]}`);
  passed.push("Refund escrow (Yield)");

  // ════════════════════════════════════════════════
  // TEST 4: Dispute Escrow
  // ════════════════════════════════════════════════
  console.log("\n━━━ TEST 4: Create & Dispute Escrow ━━━\n");

  const amount3 = ethers.parseUnits("25", 6);
  const txApprove3 = await usdc.approve(C.EscrowCore, amount3);
  await txApprove3.wait();
  console.log("  ✅ Approved 25 USDC");

  const desc3 = ethers.encodeBytes32String("Dispute test #3");
  const txCreate3 = await core.createEscrow(seller1, amount3, BigInt(Math.floor(Date.now()/1000) + 30*86400), false, 0, desc3, { gasLimit: 5000000 });
  console.log(`  Create TX:   ${link("tx", txCreate3.hash)}`);
  await txCreate3.wait();
  const escrowId3 = Number(await core.nextEscrowId()) - 1;
  console.log(`  ✅ Escrow #${escrowId3} created`);

  const txDispute = await core.disputeEscrow(escrowId3, { gasLimit: 5000000 });
  console.log(`  Dispute TX:  ${link("tx", txDispute.hash)}`);
  await txDispute.wait();
  const e3d = await core.getEscrow(escrowId3);
  console.log(`  ✅ Status: ${STATUS[Number(e3d.status)]}`);
  passed.push("Dispute escrow");

  // ════════════════════════════════════════════════
  // TEST 5: Wiring verification
  // ════════════════════════════════════════════════
  console.log("\n━━━ TEST 5: Permission Wiring Verification ━━━\n");

  const nftMinter = await nft.minter();
  const vaultCoreAddr = await vault.coreContract();
  const fiatCoreAddr = await fiat.coreContract();
  const correct = nftMinter === C.EscrowCore && vaultCoreAddr === C.EscrowCore && fiatCoreAddr === C.EscrowCore;
  console.log(`  NFT minter → EscrowCore:          ${nftMinter === C.EscrowCore ? "✅" : "❌"} ${nftMinter}`);
  console.log(`  YieldVault core → EscrowCore:      ${vaultCoreAddr === C.EscrowCore ? "✅" : "❌"} ${vaultCoreAddr}`);
  console.log(`  FiatSettlement core → EscrowCore:   ${fiatCoreAddr === C.EscrowCore ? "✅" : "❌"} ${fiatCoreAddr}`);
  if (correct) passed.push("Wiring verification"); else failed.push("Wiring verification");

  // ════════════════════════════════════════════════
  // TEST 6: Final balance check
  // ════════════════════════════════════════════════
  console.log("\n━━━ TEST 6: Final Balances ━━━\n");
  const finalUsdc = await usdc.balanceOf(wallet.address);
  const finalPas = await ethers.provider.getBalance(wallet.address);
  console.log(`  USDC:    ${ethers.formatUnits(finalUsdc, 6)}`);
  console.log(`  PAS:     ${ethers.formatUnits(finalPas, 18)}`);
  passed.push("Final balances");

  // ════════════════════════════════════════════════
  // SUMMARY
  // ════════════════════════════════════════════════
  console.log("\n╔════════════════════════════════════════════════════════╗");
  console.log("║                    TEST SUMMARY                        ║");
  console.log("╠════════════════════════════════════════════════════════╣");
  for (const t of passed) console.log(`║  ✅ ${t.padEnd(50)}║`);
  for (const t of failed) console.log(`║  ❌ ${t.padEnd(50)}║`);
  console.log("╠════════════════════════════════════════════════════════╣");
  console.log(`║  Passed: ${passed.length}/${passed.length + failed.length}`.padEnd(57) + "║");
  console.log("╠════════════════════════════════════════════════════════╣");
  console.log("║  Contract Explorer Links:                              ║");
  console.log(`║  EscrowCore:     ${link("address", C.EscrowCore).slice(0,45)}...  ║`);
  console.log(`║  InvoiceMarket:  ${link("address", C.InvoiceMarket).slice(0,45)}...  ║`);
  console.log(`║  InvoiceNFT:     ${link("address", C.InvoiceNFT).slice(0,45)}...  ║`);
  console.log(`║  MockUSDC:       ${link("address", C.USDC).slice(0,45)}...  ║`);
  console.log(`║  Oracle:         ${link("address", C.Oracle).slice(0,45)}...  ║`);
  console.log(`║  YieldVault:     ${link("address", C.YieldVault).slice(0,45)}...  ║`);
  console.log(`║  FiatSettlement: ${link("address", C.FiatSettlement).slice(0,45)}...  ║`);
  console.log("╚════════════════════════════════════════════════════════╝\n");

  if (failed.length > 0) process.exit(1);
}

main().catch((err) => {
  console.error("\n❌ Error:", err.message?.slice(0, 300));
  process.exit(1);
});
