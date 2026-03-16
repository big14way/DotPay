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
  console.log("\nRedeploying InvoiceCore from:", wallet.address);
  console.log("PAS:", ethers.formatUnits(await ethers.provider.getBalance(wallet.address), 18));

  // Deploy new InvoiceCore
  console.log("\n── Deploying InvoiceCore ──");
  const CoreFactory = await ethers.getContractFactory("InvoiceCore", wallet);
  const core = await CoreFactory.deploy(
    DEPLOYED.USDC,
    DEPLOYED.InvoiceNFT,
    DEPLOYED.ComplianceOracle,
    DEPLOYED.XCMYieldVault,
    DEPLOYED.FiatSettlement,
    wallet.address, // feeRecipient
    { gasLimit: 50000000 }
  );
  await core.waitForDeployment();
  const coreAddr = await core.getAddress();
  console.log(`  ✅ InvoiceCore: ${coreAddr}`);
  console.log(`  Explorer: ${EXPLORER}/address/${coreAddr}`);

  // Test if it works
  console.log("\n── Testing new InvoiceCore ──");
  try {
    const paused = await core.paused();
    console.log("  paused():", paused);
    const nextId = await core.nextEscrowId();
    console.log("  nextEscrowId():", nextId.toString());
    const owner = await core.owner();
    console.log("  owner():", owner);
    console.log("  ✅ All view functions work!\n");
  } catch(err) {
    console.log("  ❌ Still failing:", err.message?.slice(0, 100));
    return;
  }

  // Re-wire: set InvoiceCore as the minter on InvoiceNFT
  console.log("── Wiring permissions ──");
  const nft = new ethers.Contract(DEPLOYED.InvoiceNFT, [
    "function setMinter(address) external",
    "function minter() view returns (address)",
  ], wallet);

  const tx1 = await nft.setMinter(coreAddr);
  console.log(`  setMinter TX: ${EXPLORER}/tx/${tx1.hash}`);
  await tx1.wait();
  console.log("  ✅ NFT minter set to new InvoiceCore");

  // Set InvoiceCore as the core contract on YieldVault
  const vault = new ethers.Contract(DEPLOYED.XCMYieldVault, [
    "function setCoreContract(address) external",
  ], wallet);
  const tx2 = await vault.setCoreContract(coreAddr);
  console.log(`  setCoreContract TX: ${EXPLORER}/tx/${tx2.hash}`);
  await tx2.wait();
  console.log("  ✅ YieldVault core set to new InvoiceCore");

  // Set core on FiatSettlement
  const fiat = new ethers.Contract(DEPLOYED.FiatSettlement, [
    "function setCoreContract(address) external",
  ], wallet);
  const tx3 = await fiat.setCoreContract(coreAddr);
  console.log(`  setCoreContract TX: ${EXPLORER}/tx/${tx3.hash}`);
  await tx3.wait();
  console.log("  ✅ FiatSettlement core set to new InvoiceCore");

  console.log("\n========================================");
  console.log("  DONE — Update these addresses:");
  console.log("========================================");
  console.log(`  InvoiceCore: "${coreAddr}"`);
  console.log(`\n  Update in:`);
  console.log(`  - frontend/src/config/contracts.ts`);
  console.log(`  - frontend/.env.local.example`);
  console.log(`  - README.md`);
  console.log("");
}

main().catch((err) => {
  console.error("\n❌ Error:", err.message?.slice(0, 300));
  process.exit(1);
});
