const hre = require("hardhat");
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

async function main() {
  const provider = new hre.ethers.JsonRpcProvider(
    "https://eth-rpc-testnet.polkadot.io/"
  );
  const PRIVATE_KEY = process.env.PRIVATE_KEY.replace(/^0x/, "");
  const deployer = new hre.ethers.Wallet(`0x${PRIVATE_KEY}`, provider);

  console.log("Deploying with account:", deployer.address);

  const balance = await provider.getBalance(deployer.address);
  console.log("Account balance:", hre.ethers.formatUnits(balance, 18), "PAS");
  console.log("---");

  // Helper to deploy a contract
  async function deploy(name, args = []) {
    const factory = await hre.ethers.getContractFactory(name);
    const contract = await factory.connect(deployer).deploy(...args);
    await contract.waitForDeployment();
    const addr = await contract.getAddress();
    console.log(`  ${name}: ${addr}`);
    return contract;
  }

  // 1. Deploy MockUSDC
  console.log("1/6 Deploying MockUSDC...");
  const usdc = await deploy("MockUSDC");
  const usdcAddr = await usdc.getAddress();

  // 2. Deploy ComplianceOracle
  console.log("2/6 Deploying ComplianceOracle...");
  const oracle = await deploy("ComplianceOracle", [deployer.address]);
  const oracleAddr = await oracle.getAddress();

  // 3. Deploy XCMYieldVault
  console.log("3/6 Deploying XCMYieldVault...");
  const yieldVault = await deploy("XCMYieldVault", [usdcAddr, deployer.address]);
  const yieldVaultAddr = await yieldVault.getAddress();

  // 4. Deploy FiatSettlement
  console.log("4/6 Deploying FiatSettlement...");
  const fiatSettlement = await deploy("FiatSettlement", [usdcAddr, deployer.address]);
  const fiatSettlementAddr = await fiatSettlement.getAddress();

  // 5. Deploy InvoiceNFT (temporary minter = deployer)
  console.log("5/6 Deploying InvoiceNFT...");
  const nft = await deploy("InvoiceNFT", [deployer.address, deployer.address]);
  const nftAddr = await nft.getAddress();

  // 6. Deploy InvoiceCore
  console.log("6/6 Deploying InvoiceCore...");
  const core = await deploy("InvoiceCore", [
    usdcAddr,
    nftAddr,
    oracleAddr,
    yieldVaultAddr,
    fiatSettlementAddr,
    deployer.address, // feeRecipient = deployer for now
  ]);
  const coreAddr = await core.getAddress();

  // 7. Wire up permissions
  console.log("\nWiring permissions...");

  console.log("  Setting InvoiceCore as NFT minter...");
  const tx1 = await nft.setMinter(coreAddr);
  await tx1.wait();

  console.log("  Setting InvoiceCore as YieldVault core...");
  const tx2 = await yieldVault.setCoreContract(coreAddr);
  await tx2.wait();

  console.log("  Setting InvoiceCore as FiatSettlement core...");
  const tx3 = await fiatSettlement.setCoreContract(coreAddr);
  await tx3.wait();

  // 8. Set deployer as Basic KYC for testing
  console.log("  Setting deployer KYC to Basic...");
  const tx4 = await oracle.setKycLevel(deployer.address, 1);
  await tx4.wait();

  console.log("\n========================================");
  console.log("  DEPLOYMENT COMPLETE");
  console.log("========================================");
  console.log("");
  console.log("Contract Addresses:");
  console.log("  MockUSDC:         ", usdcAddr);
  console.log("  ComplianceOracle: ", oracleAddr);
  console.log("  XCMYieldVault:    ", yieldVaultAddr);
  console.log("  FiatSettlement:   ", fiatSettlementAddr);
  console.log("  InvoiceNFT:       ", nftAddr);
  console.log("  InvoiceCore:      ", coreAddr);
  console.log("");
  console.log("Network:  Polkadot Hub Testnet (Chain ID: 420420417)");
  console.log("Explorer: https://blockscout-testnet.polkadot.io/");
  console.log("");

  const balanceAfter = await provider.getBalance(deployer.address);
  console.log("Gas spent:", hre.ethers.formatUnits(balance - balanceAfter, 18), "PAS");
  console.log("Remaining:", hre.ethers.formatUnits(balanceAfter, 18), "PAS");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
