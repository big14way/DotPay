const { ethers } = require("hardhat");

const EXPLORER = "https://blockscout-testnet.polkadot.io";

async function main() {
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, ethers.provider);
  console.log("Wallet:", wallet.address);

  const usdc = new ethers.Contract("0xC3a201c2Dc904ae32a9a0adea3478EB252d5Cf88", [
    "function transfer(address,uint256) returns (bool)",
    "function balanceOf(address) view returns (uint256)",
  ], wallet);

  const vault = "0x9C7af8B9e41555ce384a67f563Fa0d20D1dD9DFc";

  // Check current vault balance
  const vaultBal = await usdc.balanceOf(vault);
  console.log("Vault USDC balance:", ethers.formatUnits(vaultBal, 6));

  // Send 1000 USDC to vault to cover simulated yield payouts
  const amount = ethers.parseUnits("1000", 6);
  console.log("\nSending 1,000 USDC to YieldVault for yield payouts...");
  const tx = await usdc.transfer(vault, amount);
  console.log(`TX: ${EXPLORER}/tx/${tx.hash}`);
  await tx.wait();

  const newBal = await usdc.balanceOf(vault);
  console.log(`\n✅ Vault USDC balance: ${ethers.formatUnits(newBal, 6)}`);
}

main().catch(console.error);
