const { ethers } = require("hardhat");

const EXPLORER = "https://blockscout-testnet.polkadot.io";

const DEPLOYED = {
  USDC: "0xC3a201c2Dc904ae32a9a0adea3478EB252d5Cf88",
  InvoiceNFT: "0x8486E62b5975A4241818b564834A5f51ae2540B6",
  ComplianceOracle: "0xde5eCbdf2e9601C4B4a08899EAa836081011F7ac",
  XCMYieldVault: "0x9C7af8B9e41555ce384a67f563Fa0d20D1dD9DFc",
  FiatSettlement: "0xd8E68c3B9D3637CB99054efEdeE20BD8aeea45f1",
};

async function main() {
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, ethers.provider);
  console.log("\nDeploying split contracts from:", wallet.address);
  const bal = await ethers.provider.getBalance(wallet.address);
  console.log("PAS:", ethers.formatUnits(bal, 18));

  // Deploy EscrowCore
  console.log("\n── Deploying EscrowCore ──");
  const EscrowFactory = await ethers.getContractFactory("EscrowCore", wallet);
  const escrowCore = await EscrowFactory.deploy(
    DEPLOYED.USDC,
    DEPLOYED.InvoiceNFT,
    DEPLOYED.ComplianceOracle,
    DEPLOYED.XCMYieldVault,
    DEPLOYED.FiatSettlement,
    wallet.address, // feeRecipient
    { gasLimit: 50000000 }
  );
  await escrowCore.waitForDeployment();
  const escrowAddr = await escrowCore.getAddress();
  console.log(`  EscrowCore: ${escrowAddr}`);
  console.log(`  Explorer: ${EXPLORER}/address/${escrowAddr}`);

  // Test EscrowCore
  console.log("\n── Testing EscrowCore ──");
  try {
    const paused = await escrowCore.paused();
    console.log("  paused():", paused);
    const nextId = await escrowCore.nextEscrowId();
    console.log("  nextEscrowId():", nextId.toString());
    const owner = await escrowCore.owner();
    console.log("  owner():", owner);
    console.log("  ✅ EscrowCore view functions work!");
  } catch(err) {
    console.log("  ❌ EscrowCore failed:", err.message?.slice(0, 200));
    return;
  }

  // Deploy InvoiceMarket
  console.log("\n── Deploying InvoiceMarket ──");
  const MarketFactory = await ethers.getContractFactory("InvoiceMarket", wallet);
  const market = await MarketFactory.deploy(
    DEPLOYED.USDC,
    DEPLOYED.InvoiceNFT,
    escrowAddr,
    { gasLimit: 50000000 }
  );
  await market.waitForDeployment();
  const marketAddr = await market.getAddress();
  console.log(`  InvoiceMarket: ${marketAddr}`);
  console.log(`  Explorer: ${EXPLORER}/address/${marketAddr}`);

  // Test InvoiceMarket
  console.log("\n── Testing InvoiceMarket ──");
  try {
    const nextListing = await market.nextListingId();
    console.log("  nextListingId():", nextListing.toString());
    console.log("  ✅ InvoiceMarket view functions work!");
  } catch(err) {
    console.log("  ❌ InvoiceMarket failed:", err.message?.slice(0, 200));
    return;
  }

  // Wire permissions
  console.log("\n── Wiring permissions ──");

  // Set market contract on EscrowCore
  const tx1 = await escrowCore.setMarketContract(marketAddr);
  await tx1.wait();
  console.log("  ✅ EscrowCore.setMarketContract →", marketAddr);

  // Set EscrowCore as minter on InvoiceNFT
  const nft = new ethers.Contract(DEPLOYED.InvoiceNFT, [
    "function setMinter(address) external",
    "function minter() view returns (address)",
  ], wallet);
  const tx2 = await nft.setMinter(escrowAddr);
  await tx2.wait();
  console.log("  ✅ InvoiceNFT.setMinter →", escrowAddr);

  // Set EscrowCore as core on YieldVault
  const vault = new ethers.Contract(DEPLOYED.XCMYieldVault, [
    "function setCoreContract(address) external",
  ], wallet);
  const tx3 = await vault.setCoreContract(escrowAddr);
  await tx3.wait();
  console.log("  ✅ XCMYieldVault.setCoreContract →", escrowAddr);

  // Set EscrowCore as core on FiatSettlement
  const fiat = new ethers.Contract(DEPLOYED.FiatSettlement, [
    "function setCoreContract(address) external",
  ], wallet);
  const tx4 = await fiat.setCoreContract(escrowAddr);
  await tx4.wait();
  console.log("  ✅ FiatSettlement.setCoreContract →", escrowAddr);

  console.log("\n========================================");
  console.log("  DEPLOYMENT COMPLETE");
  console.log("========================================");
  console.log(`  EscrowCore:    "${escrowAddr}"`);
  console.log(`  InvoiceMarket: "${marketAddr}"`);
  console.log("\n  Update in:");
  console.log("  - frontend/src/config/contracts.ts");
  console.log("  - frontend/src/config/abis.ts");
  console.log("");
}

main().catch((err) => {
  console.error("\n❌ Error:", err.message?.slice(0, 300));
  process.exit(1);
});
