const { ethers } = require("hardhat");
async function main() {
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, ethers.provider);
  const usdc = new ethers.Contract("0xC3a201c2Dc904ae32a9a0adea3478EB252d5Cf88", [
    "function approve(address,uint256) returns (bool)",
    "function balanceOf(address) view returns (uint256)",
  ], wallet);
  const core = new ethers.Contract("0x4d88c574A9D573a5C62C692e4714F61829d7E4a6", [
    "function createEscrow(address,uint256,uint64,bool,uint8,bytes32) returns (uint256)",
    "function releaseEscrow(uint256)",
    "function getEscrow(uint256) view returns (tuple(uint256 id,address buyer,address seller,uint256 amount,uint256 yieldAccrued,uint64 createdAt,uint64 releasedAt,uint64 deadline,uint8 status,uint8 rail,bool yieldEnabled,uint256 nftTokenId,bytes32 description))",
    "function nextEscrowId() view returns (uint256)",
    "function previewYield(uint256) view returns (uint256)",
  ], wallet);

  const balBefore = await usdc.balanceOf(wallet.address);
  console.log("USDC before:", ethers.formatUnits(balBefore, 6));

  // Approve + create yield escrow
  const amount = ethers.parseUnits("200", 6);
  await (await usdc.approve("0x4d88c574A9D573a5C62C692e4714F61829d7E4a6", amount)).wait();
  console.log("Approved 200 USDC");

  const deadline = BigInt(Math.floor(Date.now()/1000) + 30*86400);
  const desc = ethers.encodeBytes32String("Yield test");
  await (await core.createEscrow("0x1111111111111111111111111111111111111111", amount, deadline, true, 1, desc, { gasLimit: 5000000 })).wait();
  const escrowId = Number(await core.nextEscrowId()) - 1;
  console.log("Yield escrow #" + escrowId + " created");

  // Check yield preview
  const yieldPreview = await core.previewYield(escrowId);
  console.log("Yield preview (immediate):", ethers.formatUnits(yieldPreview, 6), "USDC");

  // Release to test yield payout
  console.log("Releasing...");
  await (await core.releaseEscrow(escrowId, { gasLimit: 5000000 })).wait();
  const e = await core.getEscrow(escrowId);
  console.log("Released! Status:", ["Active","Released","Refunded","Disputed"][Number(e.status)]);
  console.log("Yield accrued:", ethers.formatUnits(e.yieldAccrued, 6), "USDC");

  const balAfter = await usdc.balanceOf(wallet.address);
  console.log("USDC after:", ethers.formatUnits(balAfter, 6));
  console.log("Net change:", ethers.formatUnits(balAfter - balBefore, 6), "USDC");
}
main().catch(e => console.error("Error:", e.message?.slice(0,200)));
