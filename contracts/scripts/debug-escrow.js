const { ethers } = require("hardhat");

async function main() {
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, ethers.provider);
  console.log("Wallet:", wallet.address);

  // Test each contract individually
  const contracts = [
    { name: "MockUSDC", addr: "0xC3a201c2Dc904ae32a9a0adea3478EB252d5Cf88", abi: ["function balanceOf(address) view returns (uint256)"], call: async (c) => ethers.formatUnits(await c.balanceOf(wallet.address), 6) + " USDC" },
    { name: "Oracle", addr: "0xde5eCbdf2e9601C4B4a08899EAa836081011F7ac", abi: ["function kycLevel(address) view returns (uint8)"], call: async (c) => "KYC level: " + (await c.kycLevel(wallet.address)).toString() },
    { name: "YieldVault", addr: "0x9C7af8B9e41555ce384a67f563Fa0d20D1dD9DFc", abi: ["function simulatedApyBps() view returns (uint256)"], call: async (c) => "APY: " + (await c.simulatedApyBps()).toString() + " bps" },
    { name: "InvoiceNFT", addr: "0x8486E62b5975A4241818b564834A5f51ae2540B6", abi: ["function name() view returns (string)"], call: async (c) => await c.name() },
    { name: "FiatSettlement", addr: "0xd8E68c3B9D3637CB99054efEdeE20BD8aeea45f1", abi: ["function owner() view returns (address)"], call: async (c) => "owner: " + await c.owner() },
    { name: "InvoiceCore", addr: "0xe3D37E5c036CC0bb4E0A170D49cc9212ABc8f985", abi: ["function paused() view returns (bool)"], call: async (c) => "paused: " + await c.paused() },
    { name: "InvoiceCore.nextEscrowId", addr: "0xe3D37E5c036CC0bb4E0A170D49cc9212ABc8f985", abi: ["function nextEscrowId() view returns (uint256)"], call: async (c) => "nextId: " + (await c.nextEscrowId()).toString() },
    { name: "InvoiceCore.owner", addr: "0xe3D37E5c036CC0bb4E0A170D49cc9212ABc8f985", abi: ["function owner() view returns (address)"], call: async (c) => "owner: " + await c.owner() },
  ];

  for (const { name, addr, abi, call } of contracts) {
    try {
      const c = new ethers.Contract(addr, abi, wallet);
      const result = await call(c);
      console.log(`✅ ${name}: ${result}`);
    } catch (err) {
      console.log(`❌ ${name}: ${err.message?.slice(0, 100)}`);
    }
  }
}

main().catch(console.error);
