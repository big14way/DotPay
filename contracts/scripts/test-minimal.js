const { ethers } = require("hardhat");

async function main() {
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, ethers.provider);
  console.log("Testing contract sizes on PolkaVM...\n");

  // Check bytecode sizes
  const artifacts = [
    "MockUSDC",
    "ComplianceOracle",
    "InvoiceNFT",
    "XCMYieldVault",
    "FiatSettlement",
    "EscrowCore",
    "InvoiceMarket",
    "InvoiceCore",
  ];

  for (const name of artifacts) {
    try {
      const factory = await ethers.getContractFactory(name, wallet);
      const bytecodeSize = factory.bytecode.length / 2 - 1; // hex to bytes
      console.log(`  ${name}: ${bytecodeSize} bytes`);
    } catch(err) {
      console.log(`  ${name}: error getting bytecode`);
    }
  }
}

main().catch(console.error);
