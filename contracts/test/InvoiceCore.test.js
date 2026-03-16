const { expect } = require("chai");
const { ethers } = require("hardhat");
const {
  loadFixture,
  time,
} = require("@nomicfoundation/hardhat-toolbox/network-helpers");

describe("DotPay — Comprehensive Test Suite", function () {
  // ─── Shared Fixture ──────────────────────────────────────────────

  async function deployFullFixture() {
    const [owner, buyer, seller, feeRecipient, factorBuyer, blacklisted, stranger] =
      await ethers.getSigners();

    // 1. Deploy MockUSDC
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    const usdc = await MockUSDC.deploy();
    const usdcAddr = await usdc.getAddress();

    // 2. Deploy ComplianceOracle
    const ComplianceOracle = await ethers.getContractFactory("ComplianceOracle");
    const oracle = await ComplianceOracle.deploy(owner.address);

    // 3. Deploy XCMYieldVault
    const XCMYieldVault = await ethers.getContractFactory("XCMYieldVault");
    const yieldVault = await XCMYieldVault.deploy(usdcAddr, owner.address);

    // 4. Deploy FiatSettlement
    const FiatSettlement = await ethers.getContractFactory("FiatSettlement");
    const fiatSettlement = await FiatSettlement.deploy(usdcAddr, owner.address);

    // 5. Deploy InvoiceNFT (temporary minter = owner, updated after core deploy)
    const InvoiceNFT = await ethers.getContractFactory("InvoiceNFT");
    const nft = await InvoiceNFT.deploy(owner.address, owner.address);

    // 6. Deploy InvoiceCore
    const InvoiceCore = await ethers.getContractFactory("InvoiceCore");
    const core = await InvoiceCore.deploy(
      usdcAddr,
      await nft.getAddress(),
      await oracle.getAddress(),
      await yieldVault.getAddress(),
      await fiatSettlement.getAddress(),
      feeRecipient.address
    );
    const coreAddr = await core.getAddress();

    // 7. Wire up permissions
    await nft.setMinter(coreAddr);
    await yieldVault.setCoreContract(coreAddr);
    await fiatSettlement.setCoreContract(coreAddr);

    // 8. KYC: Basic for buyer, seller, factorBuyer; Advanced for owner
    await oracle.setKycLevel(buyer.address, 1);      // Basic  — limit 1,000 USDC
    await oracle.setKycLevel(seller.address, 1);      // Basic
    await oracle.setKycLevel(factorBuyer.address, 1); // Basic
    await oracle.setKycLevel(owner.address, 2);       // Advanced — limit 100,000 USDC

    // 9. Fund accounts with USDC
    const TEN_K = ethers.parseUnits("10000", 6);
    await usdc.mint(buyer.address, TEN_K);
    await usdc.mint(factorBuyer.address, TEN_K);
    await usdc.mint(owner.address, TEN_K);

    // 10. Approvals
    await usdc.connect(buyer).approve(coreAddr, ethers.MaxUint256);
    await usdc.connect(factorBuyer).approve(coreAddr, ethers.MaxUint256);
    await usdc.connect(owner).approve(coreAddr, ethers.MaxUint256);
    await usdc.connect(seller).approve(coreAddr, ethers.MaxUint256);

    // Handy constants
    const AMOUNT = ethers.parseUnits("1000", 6);
    const DESC   = ethers.encodeBytes32String("INV-001");

    // Valid Stellar G-address (56 ASCII bytes starting with 'G')
    const STELLAR_ADDR = ethers.toUtf8Bytes(
      "GABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVW"
    );

    return {
      usdc, oracle, yieldVault, fiatSettlement, nft, core,
      owner, buyer, seller, feeRecipient, factorBuyer, blacklisted, stranger,
      AMOUNT, DESC, STELLAR_ADDR, coreAddr,
    };
  }

  // Helper: create a standard non-yield escrow and return its ID
  async function createBasicEscrow(core, buyer, seller, amount, desc) {
    const tx = await core
      .connect(buyer)
      .createEscrow(seller, amount, 0, false, 0, desc);
    const receipt = await tx.wait();
    return 1n; // first escrow is always ID 1 in a fresh fixture
  }

  // ════════════════════════════════════════════════════════════════
  //  DEPLOYMENT
  // ════════════════════════════════════════════════════════════════

  describe("Deployment", function () {
    it("deploys all contracts with correct addresses", async function () {
      const { core, usdc, nft, oracle, yieldVault, fiatSettlement } =
        await loadFixture(deployFullFixture);

      expect(await core.usdc()).to.equal(await usdc.getAddress());
      expect(await core.nft()).to.equal(await nft.getAddress());
      expect(await core.oracle()).to.equal(await oracle.getAddress());
      expect(await core.yieldVault()).to.equal(await yieldVault.getAddress());
      expect(await core.fiatSettlement()).to.equal(
        await fiatSettlement.getAddress()
      );
    });

    it("sets fee recipient correctly", async function () {
      const { core, feeRecipient } = await loadFixture(deployFullFixture);
      expect(await core.feeRecipient()).to.equal(feeRecipient.address);
    });

    it("sets nextEscrowId to 1", async function () {
      const { core } = await loadFixture(deployFullFixture);
      expect(await core.nextEscrowId()).to.equal(1);
    });

    it("approves yieldVault and fiatSettlement to pull USDC", async function () {
      const { usdc, core, yieldVault, fiatSettlement, coreAddr } =
        await loadFixture(deployFullFixture);

      const vaultAllowance = await usdc.allowance(
        coreAddr,
        await yieldVault.getAddress()
      );
      const fiatAllowance = await usdc.allowance(
        coreAddr,
        await fiatSettlement.getAddress()
      );
      expect(vaultAllowance).to.equal(ethers.MaxUint256);
      expect(fiatAllowance).to.equal(ethers.MaxUint256);
    });

    it("sets InvoiceCore as minter on InvoiceNFT", async function () {
      const { nft, coreAddr } = await loadFixture(deployFullFixture);
      expect(await nft.minter()).to.equal(coreAddr);
    });

    it("sets InvoiceCore as core on YieldVault", async function () {
      const { yieldVault, coreAddr } = await loadFixture(deployFullFixture);
      expect(await yieldVault.coreContract()).to.equal(coreAddr);
    });

    it("sets InvoiceCore as core on FiatSettlement", async function () {
      const { fiatSettlement, coreAddr } = await loadFixture(deployFullFixture);
      expect(await fiatSettlement.coreContract()).to.equal(coreAddr);
    });

    it("sets correct constants", async function () {
      const { core } = await loadFixture(deployFullFixture);
      expect(await core.LTV_BPS()).to.equal(8000);
      expect(await core.PLATFORM_FEE_BPS()).to.equal(50);
      expect(await core.YIELD_SPLIT_SELLER()).to.equal(1500);
      expect(await core.YIELD_SPLIT_BUYER()).to.equal(8000);
    });
  });

  // ════════════════════════════════════════════════════════════════
  //  createEscrow
  // ════════════════════════════════════════════════════════════════

  describe("createEscrow", function () {
    it("creates escrow with correct ID, buyer, seller, amount", async function () {
      const { core, buyer, seller, AMOUNT, DESC } =
        await loadFixture(deployFullFixture);

      await core
        .connect(buyer)
        .createEscrow(seller.address, AMOUNT, 0, false, 0, DESC);

      const e = await core.getEscrow(1);
      expect(e.id).to.equal(1);
      expect(e.buyer).to.equal(buyer.address);
      expect(e.seller).to.equal(seller.address);
      expect(e.amount).to.equal(AMOUNT);
      expect(e.status).to.equal(0); // Active
      expect(e.yieldEnabled).to.be.false;
      expect(e.description).to.equal(DESC);
    });

    it("mints NFT to seller with correct escrowId mapping", async function () {
      const { core, nft, buyer, seller, AMOUNT, DESC } =
        await loadFixture(deployFullFixture);

      await core
        .connect(buyer)
        .createEscrow(seller.address, AMOUNT, 0, false, 0, DESC);

      expect(await nft.ownerOf(1)).to.equal(seller.address);
      expect(await nft.escrowIdOf(1)).to.equal(1);
    });

    it("pulls USDC from buyer", async function () {
      const { core, usdc, buyer, seller, AMOUNT, DESC } =
        await loadFixture(deployFullFixture);

      const balBefore = await usdc.balanceOf(buyer.address);
      await core
        .connect(buyer)
        .createEscrow(seller.address, AMOUNT, 0, false, 0, DESC);
      const balAfter = await usdc.balanceOf(buyer.address);

      expect(balBefore - balAfter).to.equal(AMOUNT);
    });

    it("emits EscrowCreated event with all fields", async function () {
      const { core, buyer, seller, AMOUNT, DESC } =
        await loadFixture(deployFullFixture);

      await expect(
        core
          .connect(buyer)
          .createEscrow(seller.address, AMOUNT, 0, false, 0, DESC)
      )
        .to.emit(core, "EscrowCreated")
        .withArgs(1, buyer.address, seller.address, AMOUNT, 1, 0);
    });

    it("increments nextEscrowId", async function () {
      const { core, buyer, seller, AMOUNT, DESC } =
        await loadFixture(deployFullFixture);

      await core
        .connect(buyer)
        .createEscrow(seller.address, AMOUNT, 0, false, 0, DESC);
      expect(await core.nextEscrowId()).to.equal(2);

      await core
        .connect(buyer)
        .createEscrow(
          seller.address,
          AMOUNT,
          0,
          false,
          0,
          ethers.encodeBytes32String("INV-002")
        );
      expect(await core.nextEscrowId()).to.equal(3);
    });

    it("stores correct deadline and createdAt timestamp", async function () {
      const { core, buyer, seller, AMOUNT, DESC } =
        await loadFixture(deployFullFixture);

      const futureDeadline = (await time.latest()) + 7 * 24 * 3600; // +7 days
      await core
        .connect(buyer)
        .createEscrow(seller.address, AMOUNT, futureDeadline, false, 0, DESC);

      const e = await core.getEscrow(1);
      expect(e.deadline).to.equal(futureDeadline);
      expect(e.createdAt).to.be.gt(0);
    });

    it("reverts if KYC level is None", async function () {
      const { core, usdc, blacklisted, seller, AMOUNT, DESC } =
        await loadFixture(deployFullFixture);

      await usdc.mint(blacklisted.address, AMOUNT);
      await usdc
        .connect(blacklisted)
        .approve(await core.getAddress(), ethers.MaxUint256);

      await expect(
        core
          .connect(blacklisted)
          .createEscrow(seller.address, AMOUNT, 0, false, 0, DESC)
      ).to.be.revertedWithCustomError(core, "KycRequired");
    });

    it("reverts if amount exceeds KYC limit", async function () {
      const { core, buyer, seller, DESC } =
        await loadFixture(deployFullFixture);

      // buyer is Basic KYC (limit 1,000 USDC)
      const tooMuch = ethers.parseUnits("1500", 6);
      await expect(
        core
          .connect(buyer)
          .createEscrow(seller.address, tooMuch, 0, false, 0, DESC)
      ).to.be.revertedWithCustomError(core, "KycRequired");
    });

    it("reverts if amount is 0", async function () {
      const { core, buyer, seller, DESC } =
        await loadFixture(deployFullFixture);

      await expect(
        core.connect(buyer).createEscrow(seller.address, 0, 0, false, 0, DESC)
      ).to.be.revertedWithCustomError(core, "InvalidAmount");
    });

    it("reverts if seller is zero address", async function () {
      const { core, buyer, AMOUNT, DESC } =
        await loadFixture(deployFullFixture);

      await expect(
        core
          .connect(buyer)
          .createEscrow(ethers.ZeroAddress, AMOUNT, 0, false, 0, DESC)
      ).to.be.revertedWithCustomError(core, "Unauthorized");
    });

    it("reverts if seller is buyer (self-pay)", async function () {
      const { core, buyer, AMOUNT, DESC } =
        await loadFixture(deployFullFixture);

      await expect(
        core
          .connect(buyer)
          .createEscrow(buyer.address, AMOUNT, 0, false, 0, DESC)
      ).to.be.revertedWithCustomError(core, "Unauthorized");
    });

    it("reverts with expired deadline", async function () {
      const { core, buyer, seller, AMOUNT, DESC } =
        await loadFixture(deployFullFixture);

      const past = (await time.latest()) - 100;
      await expect(
        core
          .connect(buyer)
          .createEscrow(seller.address, AMOUNT, past, false, 0, DESC)
      ).to.be.revertedWithCustomError(core, "DeadlineExpired");
    });

    it("creates yield-enabled escrow and routes to vault", async function () {
      const { core, usdc, yieldVault, buyer, seller, AMOUNT, DESC } =
        await loadFixture(deployFullFixture);

      await core
        .connect(buyer)
        .createEscrow(seller.address, AMOUNT, 0, true, 0, DESC);

      const e = await core.getEscrow(1);
      expect(e.yieldEnabled).to.be.true;

      // Funds should be in the yield vault, not in core
      expect(await usdc.balanceOf(await yieldVault.getAddress())).to.equal(
        AMOUNT
      );

      // Vault tracks the deposit
      expect(await yieldVault.deposited(1)).to.equal(AMOUNT);
      expect(await yieldVault.yieldActive(1)).to.be.true;
    });

    it("holds USDC in core when yield is disabled", async function () {
      const { core, usdc, yieldVault, buyer, seller, AMOUNT, DESC, coreAddr } =
        await loadFixture(deployFullFixture);

      await core
        .connect(buyer)
        .createEscrow(seller.address, AMOUNT, 0, false, 0, DESC);

      expect(await usdc.balanceOf(coreAddr)).to.equal(AMOUNT);
      expect(await usdc.balanceOf(await yieldVault.getAddress())).to.equal(0);
    });

    it("records settlement rail correctly", async function () {
      const { core, buyer, seller, AMOUNT, DESC } =
        await loadFixture(deployFullFixture);

      // Rail = PendulumFiat (2)
      await core
        .connect(buyer)
        .createEscrow(seller.address, AMOUNT, 0, false, 2, DESC);

      const e = await core.getEscrow(1);
      expect(e.rail).to.equal(2); // PendulumFiat
    });

    it("gas usage for createEscrow (non-yield)", async function () {
      const { core, buyer, seller, AMOUNT, DESC } =
        await loadFixture(deployFullFixture);

      const tx = await core
        .connect(buyer)
        .createEscrow(seller.address, AMOUNT, 0, false, 0, DESC);
      const receipt = await tx.wait();

      // Log gas used — should be reasonable for production
      console.log(
        "        createEscrow (non-yield) gas:",
        receipt.gasUsed.toString()
      );
      expect(receipt.gasUsed).to.be.lt(500000n);
    });

    it("gas usage for createEscrow (yield-enabled)", async function () {
      const { core, buyer, seller, AMOUNT, DESC } =
        await loadFixture(deployFullFixture);

      const tx = await core
        .connect(buyer)
        .createEscrow(seller.address, AMOUNT, 0, true, 0, DESC);
      const receipt = await tx.wait();

      console.log(
        "        createEscrow (yield)     gas:",
        receipt.gasUsed.toString()
      );
      expect(receipt.gasUsed).to.be.lt(600000n);
    });
  });

  // ════════════════════════════════════════════════════════════════
  //  releaseEscrow
  // ════════════════════════════════════════════════════════════════

  describe("releaseEscrow", function () {
    it("buyer can release, seller receives USDC minus fee", async function () {
      const { core, usdc, buyer, seller, feeRecipient, AMOUNT, DESC } =
        await loadFixture(deployFullFixture);

      await core
        .connect(buyer)
        .createEscrow(seller.address, AMOUNT, 0, false, 0, DESC);

      const sellerBefore = await usdc.balanceOf(seller.address);
      await core.connect(buyer).releaseEscrow(1);
      const sellerAfter = await usdc.balanceOf(seller.address);

      const fee = (AMOUNT * 50n) / 10000n; // 0.5%
      expect(sellerAfter - sellerBefore).to.equal(AMOUNT - fee);
    });

    it("feeRecipient receives platform fee (0.5%)", async function () {
      const { core, usdc, buyer, seller, feeRecipient, AMOUNT, DESC } =
        await loadFixture(deployFullFixture);

      await core
        .connect(buyer)
        .createEscrow(seller.address, AMOUNT, 0, false, 0, DESC);

      const feeBefore = await usdc.balanceOf(feeRecipient.address);
      await core.connect(buyer).releaseEscrow(1);
      const feeAfter = await usdc.balanceOf(feeRecipient.address);

      const expectedFee = (AMOUNT * 50n) / 10000n;
      expect(feeAfter - feeBefore).to.equal(expectedFee);
    });

    it("NFT is burned on release", async function () {
      const { core, nft, buyer, seller, AMOUNT, DESC } =
        await loadFixture(deployFullFixture);

      await core
        .connect(buyer)
        .createEscrow(seller.address, AMOUNT, 0, false, 0, DESC);

      expect(await nft.ownerOf(1)).to.equal(seller.address);

      await core.connect(buyer).releaseEscrow(1);

      // ownerOf should revert for burned token
      await expect(nft.ownerOf(1)).to.be.reverted;
    });

    it("emits EscrowReleased with correct yield (zero for non-yield)", async function () {
      const { core, buyer, seller, AMOUNT, DESC } =
        await loadFixture(deployFullFixture);

      await core
        .connect(buyer)
        .createEscrow(seller.address, AMOUNT, 0, false, 0, DESC);

      const fee = (AMOUNT * 50n) / 10000n;
      const netPayout = AMOUNT - fee;

      await expect(core.connect(buyer).releaseEscrow(1))
        .to.emit(core, "EscrowReleased")
        .withArgs(1, seller.address, netPayout, 0);
    });

    it("emits EscrowReleased with nonzero yield for yield-enabled escrow", async function () {
      const { core, usdc, yieldVault, buyer, seller, AMOUNT, DESC } =
        await loadFixture(deployFullFixture);

      await core
        .connect(buyer)
        .createEscrow(seller.address, AMOUNT, 0, true, 0, DESC);

      // Seed vault for simulated yield
      await usdc.mint(
        await yieldVault.getAddress(),
        ethers.parseUnits("100", 6)
      );

      await time.increase(30 * 24 * 3600); // 30 days

      const tx = await core.connect(buyer).releaseEscrow(1);
      const receipt = await tx.wait();

      // Find EscrowReleased event
      const event = receipt.logs.find((log) => {
        try {
          return core.interface.parseLog(log)?.name === "EscrowReleased";
        } catch {
          return false;
        }
      });
      const parsed = core.interface.parseLog(event);
      expect(parsed.args[3]).to.be.gt(0); // yield > 0
    });

    it("seller (NFT owner) can release", async function () {
      const { core, buyer, seller, AMOUNT, DESC } =
        await loadFixture(deployFullFixture);

      await core
        .connect(buyer)
        .createEscrow(seller.address, AMOUNT, 0, false, 0, DESC);

      await expect(core.connect(seller).releaseEscrow(1)).to.emit(
        core,
        "EscrowReleased"
      );
    });

    it("sets status to Released and records releasedAt", async function () {
      const { core, buyer, seller, AMOUNT, DESC } =
        await loadFixture(deployFullFixture);

      await core
        .connect(buyer)
        .createEscrow(seller.address, AMOUNT, 0, false, 0, DESC);

      await core.connect(buyer).releaseEscrow(1);

      const e = await core.getEscrow(1);
      expect(e.status).to.equal(1); // Released
      expect(e.releasedAt).to.be.gt(0);
    });

    it("deducts outstanding debt from payout on release", async function () {
      const { core, usdc, buyer, seller, feeRecipient, yieldVault, AMOUNT, DESC } =
        await loadFixture(deployFullFixture);

      // Create yield-enabled escrow
      await core
        .connect(buyer)
        .createEscrow(seller.address, AMOUNT, 0, true, 0, DESC);

      // Seed vault for yield and core for lending
      await usdc.mint(
        await yieldVault.getAddress(),
        ethers.parseUnits("100", 6)
      );
      await usdc.mint(await core.getAddress(), AMOUNT * 2n);

      // Borrow 500 USDC
      const borrowAmt = ethers.parseUnits("500", 6);
      await core.connect(seller).borrowAgainstEscrow(1, borrowAmt);

      await time.increase(30 * 24 * 3600);

      const sellerBefore = await usdc.balanceOf(seller.address);
      await core.connect(buyer).releaseEscrow(1);
      const sellerAfter = await usdc.balanceOf(seller.address);

      // Payout = (principal + yield - debt) * (1 - 0.5%)
      // Should be less than (AMOUNT - fee) because debt was deducted
      const feeOnFullAmount = (AMOUNT * 50n) / 10000n;
      const fullNoPayout = AMOUNT - feeOnFullAmount;
      expect(sellerAfter - sellerBefore).to.be.lt(fullNoPayout);
    });

    it("reverts if escrow not active (already released)", async function () {
      const { core, buyer, seller, AMOUNT, DESC } =
        await loadFixture(deployFullFixture);

      await core
        .connect(buyer)
        .createEscrow(seller.address, AMOUNT, 0, false, 0, DESC);

      await core.connect(buyer).releaseEscrow(1);

      await expect(
        core.connect(buyer).releaseEscrow(1)
      ).to.be.revertedWithCustomError(core, "EscrowNotActive");
    });

    it("reverts if escrow not active (disputed)", async function () {
      const { core, buyer, seller, AMOUNT, DESC } =
        await loadFixture(deployFullFixture);

      await core
        .connect(buyer)
        .createEscrow(seller.address, AMOUNT, 0, false, 0, DESC);

      await core.connect(buyer).disputeEscrow(1);

      await expect(
        core.connect(buyer).releaseEscrow(1)
      ).to.be.revertedWithCustomError(core, "EscrowNotActive");
    });

    it("reverts if caller is neither buyer nor NFT owner", async function () {
      const { core, buyer, seller, stranger, AMOUNT, DESC } =
        await loadFixture(deployFullFixture);

      await core
        .connect(buyer)
        .createEscrow(seller.address, AMOUNT, 0, false, 0, DESC);

      await expect(
        core.connect(stranger).releaseEscrow(1)
      ).to.be.revertedWithCustomError(core, "Unauthorized");
    });

    it("gas usage for releaseEscrow (non-yield)", async function () {
      const { core, buyer, seller, AMOUNT, DESC } =
        await loadFixture(deployFullFixture);

      await core
        .connect(buyer)
        .createEscrow(seller.address, AMOUNT, 0, false, 0, DESC);

      const tx = await core.connect(buyer).releaseEscrow(1);
      const receipt = await tx.wait();

      console.log(
        "        releaseEscrow (non-yield) gas:",
        receipt.gasUsed.toString()
      );
      expect(receipt.gasUsed).to.be.lt(300000n);
    });

    it("gas usage for releaseEscrow (yield-enabled)", async function () {
      const { core, usdc, yieldVault, buyer, seller, AMOUNT, DESC } =
        await loadFixture(deployFullFixture);

      await core
        .connect(buyer)
        .createEscrow(seller.address, AMOUNT, 0, true, 0, DESC);

      await usdc.mint(
        await yieldVault.getAddress(),
        ethers.parseUnits("100", 6)
      );
      await time.increase(30 * 24 * 3600);

      const tx = await core.connect(buyer).releaseEscrow(1);
      const receipt = await tx.wait();

      console.log(
        "        releaseEscrow (yield)     gas:",
        receipt.gasUsed.toString()
      );
      expect(receipt.gasUsed).to.be.lt(400000n);
    });
  });

  // ════════════════════════════════════════════════════════════════
  //  refundEscrow
  // ════════════════════════════════════════════════════════════════

  describe("refundEscrow", function () {
    it("buyer can refund, USDC returned in full", async function () {
      const { core, usdc, buyer, seller, AMOUNT, DESC } =
        await loadFixture(deployFullFixture);

      const balBefore = await usdc.balanceOf(buyer.address);
      await core
        .connect(buyer)
        .createEscrow(seller.address, AMOUNT, 0, false, 0, DESC);

      await core.connect(buyer).refundEscrow(1);

      const balAfter = await usdc.balanceOf(buyer.address);
      expect(balAfter).to.equal(balBefore); // full refund, no fee
    });

    it("sets status to Refunded", async function () {
      const { core, buyer, seller, AMOUNT, DESC } =
        await loadFixture(deployFullFixture);

      await core
        .connect(buyer)
        .createEscrow(seller.address, AMOUNT, 0, false, 0, DESC);

      await core.connect(buyer).refundEscrow(1);

      const e = await core.getEscrow(1);
      expect(e.status).to.equal(2); // Refunded
    });

    it("burns NFT on refund", async function () {
      const { core, nft, buyer, seller, AMOUNT, DESC } =
        await loadFixture(deployFullFixture);

      await core
        .connect(buyer)
        .createEscrow(seller.address, AMOUNT, 0, false, 0, DESC);

      await core.connect(buyer).refundEscrow(1);

      await expect(nft.ownerOf(1)).to.be.reverted;
    });

    it("emits EscrowRefunded event", async function () {
      const { core, buyer, seller, AMOUNT, DESC } =
        await loadFixture(deployFullFixture);

      await core
        .connect(buyer)
        .createEscrow(seller.address, AMOUNT, 0, false, 0, DESC);

      await expect(core.connect(buyer).refundEscrow(1))
        .to.emit(core, "EscrowRefunded")
        .withArgs(1, buyer.address, AMOUNT);
    });

    it("refunds principal + yield when yield-enabled", async function () {
      const { core, usdc, yieldVault, buyer, seller, AMOUNT, DESC } =
        await loadFixture(deployFullFixture);

      await core
        .connect(buyer)
        .createEscrow(seller.address, AMOUNT, 0, true, 0, DESC);

      // Seed vault for simulated yield
      await usdc.mint(
        await yieldVault.getAddress(),
        ethers.parseUnits("100", 6)
      );

      await time.increase(30 * 24 * 3600);

      const balBefore = await usdc.balanceOf(buyer.address);
      await core.connect(buyer).refundEscrow(1);
      const balAfter = await usdc.balanceOf(buyer.address);

      // Buyer should get back more than principal (principal + yield)
      expect(balAfter - balBefore).to.be.gt(AMOUNT);
    });

    it("reverts if outstanding debt exists", async function () {
      const { core, usdc, buyer, seller, AMOUNT, DESC } =
        await loadFixture(deployFullFixture);

      await core
        .connect(buyer)
        .createEscrow(seller.address, AMOUNT, 0, true, 0, DESC);

      await usdc.mint(await core.getAddress(), AMOUNT * 2n);
      await core
        .connect(seller)
        .borrowAgainstEscrow(1, ethers.parseUnits("100", 6));

      await expect(
        core.connect(buyer).refundEscrow(1)
      ).to.be.revertedWithCustomError(core, "OutstandingDebt");
    });

    it("reverts if caller is not buyer", async function () {
      const { core, buyer, seller, AMOUNT, DESC } =
        await loadFixture(deployFullFixture);

      await core
        .connect(buyer)
        .createEscrow(seller.address, AMOUNT, 0, false, 0, DESC);

      await expect(
        core.connect(seller).refundEscrow(1)
      ).to.be.revertedWithCustomError(core, "Unauthorized");
    });

    it("reverts if escrow not active", async function () {
      const { core, buyer, seller, AMOUNT, DESC } =
        await loadFixture(deployFullFixture);

      await core
        .connect(buyer)
        .createEscrow(seller.address, AMOUNT, 0, false, 0, DESC);

      await core.connect(buyer).refundEscrow(1);

      await expect(
        core.connect(buyer).refundEscrow(1)
      ).to.be.revertedWithCustomError(core, "EscrowNotActive");
    });
  });

  // ════════════════════════════════════════════════════════════════
  //  disputeEscrow
  // ════════════════════════════════════════════════════════════════

  describe("disputeEscrow", function () {
    it("buyer can dispute", async function () {
      const { core, buyer, seller, AMOUNT, DESC } =
        await loadFixture(deployFullFixture);

      await core
        .connect(buyer)
        .createEscrow(seller.address, AMOUNT, 0, false, 0, DESC);

      await expect(core.connect(buyer).disputeEscrow(1))
        .to.emit(core, "EscrowDisputed")
        .withArgs(1, buyer.address);

      expect((await core.getEscrow(1)).status).to.equal(3); // Disputed
    });

    it("seller (NFT owner) can dispute", async function () {
      const { core, buyer, seller, AMOUNT, DESC } =
        await loadFixture(deployFullFixture);

      await core
        .connect(buyer)
        .createEscrow(seller.address, AMOUNT, 0, false, 0, DESC);

      await expect(core.connect(seller).disputeEscrow(1))
        .to.emit(core, "EscrowDisputed")
        .withArgs(1, seller.address);
    });

    it("stranger cannot dispute", async function () {
      const { core, buyer, seller, stranger, AMOUNT, DESC } =
        await loadFixture(deployFullFixture);

      await core
        .connect(buyer)
        .createEscrow(seller.address, AMOUNT, 0, false, 0, DESC);

      await expect(
        core.connect(stranger).disputeEscrow(1)
      ).to.be.revertedWithCustomError(core, "Unauthorized");
    });

    it("cannot dispute non-active escrow", async function () {
      const { core, buyer, seller, AMOUNT, DESC } =
        await loadFixture(deployFullFixture);

      await core
        .connect(buyer)
        .createEscrow(seller.address, AMOUNT, 0, false, 0, DESC);

      await core.connect(buyer).refundEscrow(1);

      await expect(
        core.connect(buyer).disputeEscrow(1)
      ).to.be.revertedWithCustomError(core, "EscrowNotActive");
    });
  });

  // ════════════════════════════════════════════════════════════════
  //  Invoice Marketplace
  // ════════════════════════════════════════════════════════════════

  describe("Invoice Marketplace", function () {
    it("seller can list invoice at discount", async function () {
      const { core, buyer, seller, AMOUNT, DESC } =
        await loadFixture(deployFullFixture);

      await core
        .connect(buyer)
        .createEscrow(seller.address, AMOUNT, 0, false, 0, DESC);

      const listPrice = (AMOUNT * 90n) / 100n; // 90% discount
      await expect(core.connect(seller).listInvoice(1, listPrice))
        .to.emit(core, "InvoiceListed")
        .withArgs(1, 1, listPrice);

      const listing = await core.getListing(0);
      expect(listing.active).to.be.true;
      expect(listing.listPrice).to.equal(listPrice);
      expect(listing.faceValue).to.equal(AMOUNT);
      expect(listing.seller).to.equal(seller.address);
      expect(listing.escrowId).to.equal(1);
    });

    it("factoring buyer can purchase invoice NFT", async function () {
      const { core, nft, usdc, buyer, seller, factorBuyer, AMOUNT, DESC } =
        await loadFixture(deployFullFixture);

      await core
        .connect(buyer)
        .createEscrow(seller.address, AMOUNT, 0, false, 0, DESC);

      const listPrice = (AMOUNT * 90n) / 100n;
      await core.connect(seller).listInvoice(1, listPrice);

      // Seller must approve NFT transfer to core for buyInvoice
      await nft.connect(seller).approve(await core.getAddress(), 1);

      const sellerBefore = await usdc.balanceOf(seller.address);
      await expect(core.connect(factorBuyer).buyInvoice(0))
        .to.emit(core, "InvoiceSold")
        .withArgs(1, 1, factorBuyer.address, listPrice);

      const sellerAfter = await usdc.balanceOf(seller.address);
      expect(sellerAfter - sellerBefore).to.equal(listPrice);
    });

    it("NFT transfers to factoring buyer", async function () {
      const { core, nft, buyer, seller, factorBuyer, AMOUNT, DESC } =
        await loadFixture(deployFullFixture);

      await core
        .connect(buyer)
        .createEscrow(seller.address, AMOUNT, 0, false, 0, DESC);

      const listPrice = (AMOUNT * 90n) / 100n;
      await core.connect(seller).listInvoice(1, listPrice);
      await nft.connect(seller).approve(await core.getAddress(), 1);

      await core.connect(factorBuyer).buyInvoice(0);

      expect(await nft.ownerOf(1)).to.equal(factorBuyer.address);
    });

    it("factoring buyer receives USDC on release", async function () {
      const { core, nft, usdc, buyer, seller, factorBuyer, AMOUNT, DESC } =
        await loadFixture(deployFullFixture);

      await core
        .connect(buyer)
        .createEscrow(seller.address, AMOUNT, 0, false, 0, DESC);

      const listPrice = (AMOUNT * 90n) / 100n;
      await core.connect(seller).listInvoice(1, listPrice);
      await nft.connect(seller).approve(await core.getAddress(), 1);
      await core.connect(factorBuyer).buyInvoice(0);

      // Now factorBuyer owns the NFT — release should pay them
      const fbBefore = await usdc.balanceOf(factorBuyer.address);
      await core.connect(buyer).releaseEscrow(1);
      const fbAfter = await usdc.balanceOf(factorBuyer.address);

      const fee = (AMOUNT * 50n) / 10000n;
      expect(fbAfter - fbBefore).to.equal(AMOUNT - fee);
    });

    it("listing becomes inactive after purchase", async function () {
      const { core, nft, buyer, seller, factorBuyer, AMOUNT, DESC } =
        await loadFixture(deployFullFixture);

      await core
        .connect(buyer)
        .createEscrow(seller.address, AMOUNT, 0, false, 0, DESC);

      const listPrice = (AMOUNT * 90n) / 100n;
      await core.connect(seller).listInvoice(1, listPrice);
      await nft.connect(seller).approve(await core.getAddress(), 1);
      await core.connect(factorBuyer).buyInvoice(0);

      const listing = await core.getListing(0);
      expect(listing.active).to.be.false;
    });

    it("reverts if list price >= face value", async function () {
      const { core, buyer, seller, AMOUNT, DESC } =
        await loadFixture(deployFullFixture);

      await core
        .connect(buyer)
        .createEscrow(seller.address, AMOUNT, 0, false, 0, DESC);

      await expect(
        core.connect(seller).listInvoice(1, AMOUNT)
      ).to.be.revertedWithCustomError(core, "InvalidAmount");

      await expect(
        core.connect(seller).listInvoice(1, AMOUNT + 1n)
      ).to.be.revertedWithCustomError(core, "InvalidAmount");
    });

    it("reverts if list price is 0", async function () {
      const { core, buyer, seller, AMOUNT, DESC } =
        await loadFixture(deployFullFixture);

      await core
        .connect(buyer)
        .createEscrow(seller.address, AMOUNT, 0, false, 0, DESC);

      await expect(
        core.connect(seller).listInvoice(1, 0)
      ).to.be.revertedWithCustomError(core, "InvalidAmount");
    });

    it("reverts if already listed", async function () {
      const { core, buyer, seller, AMOUNT, DESC } =
        await loadFixture(deployFullFixture);

      await core
        .connect(buyer)
        .createEscrow(seller.address, AMOUNT, 0, false, 0, DESC);

      const listPrice = (AMOUNT * 90n) / 100n;
      await core.connect(seller).listInvoice(1, listPrice);

      await expect(
        core.connect(seller).listInvoice(1, listPrice)
      ).to.be.revertedWithCustomError(core, "AlreadyListed");
    });

    it("reverts if non-owner tries to list", async function () {
      const { core, buyer, seller, stranger, AMOUNT, DESC } =
        await loadFixture(deployFullFixture);

      await core
        .connect(buyer)
        .createEscrow(seller.address, AMOUNT, 0, false, 0, DESC);

      await expect(
        core.connect(stranger).listInvoice(1, AMOUNT / 2n)
      ).to.be.revertedWithCustomError(core, "Unauthorized");
    });

    it("reverts if buying inactive listing", async function () {
      const { core, nft, buyer, seller, factorBuyer, AMOUNT, DESC } =
        await loadFixture(deployFullFixture);

      await core
        .connect(buyer)
        .createEscrow(seller.address, AMOUNT, 0, false, 0, DESC);

      const listPrice = (AMOUNT * 90n) / 100n;
      await core.connect(seller).listInvoice(1, listPrice);
      await nft.connect(seller).approve(await core.getAddress(), 1);
      await core.connect(factorBuyer).buyInvoice(0);

      // Try to buy again
      await expect(
        core.connect(factorBuyer).buyInvoice(0)
      ).to.be.revertedWithCustomError(core, "InvoiceNotListed");
    });
  });

  // ════════════════════════════════════════════════════════════════
  //  borrowAgainstEscrow
  // ════════════════════════════════════════════════════════════════

  describe("borrowAgainstEscrow", function () {
    it("NFT owner can borrow up to 80% LTV", async function () {
      const { core, usdc, buyer, seller, AMOUNT, DESC } =
        await loadFixture(deployFullFixture);

      await core
        .connect(buyer)
        .createEscrow(seller.address, AMOUNT, 0, true, 0, DESC);

      // Seed core with lending liquidity
      await usdc.mint(await core.getAddress(), AMOUNT * 2n);

      const maxBorrow = (AMOUNT * 8000n) / 10000n; // 800 USDC
      expect(await core.getBorrowLimit(1)).to.equal(maxBorrow);

      const sellerBefore = await usdc.balanceOf(seller.address);
      await core.connect(seller).borrowAgainstEscrow(1, maxBorrow);
      const sellerAfter = await usdc.balanceOf(seller.address);

      expect(sellerAfter - sellerBefore).to.equal(maxBorrow);
      expect(await core.getDebt(1)).to.equal(maxBorrow);
      expect(await core.getBorrowLimit(1)).to.equal(0);
    });

    it("emits BorrowTaken event", async function () {
      const { core, usdc, buyer, seller, AMOUNT, DESC } =
        await loadFixture(deployFullFixture);

      await core
        .connect(buyer)
        .createEscrow(seller.address, AMOUNT, 0, true, 0, DESC);

      await usdc.mint(await core.getAddress(), AMOUNT * 2n);

      const borrowAmt = ethers.parseUnits("500", 6);
      await expect(core.connect(seller).borrowAgainstEscrow(1, borrowAmt))
        .to.emit(core, "BorrowTaken")
        .withArgs(1, seller.address, borrowAmt);
    });

    it("allows multiple borrows within LTV limit", async function () {
      const { core, usdc, buyer, seller, AMOUNT, DESC } =
        await loadFixture(deployFullFixture);

      await core
        .connect(buyer)
        .createEscrow(seller.address, AMOUNT, 0, true, 0, DESC);

      await usdc.mint(await core.getAddress(), AMOUNT * 2n);

      const first = ethers.parseUnits("300", 6);
      const second = ethers.parseUnits("400", 6);
      await core.connect(seller).borrowAgainstEscrow(1, first);
      await core.connect(seller).borrowAgainstEscrow(1, second);

      expect(await core.getDebt(1)).to.equal(first + second);
    });

    it("reverts if over LTV limit", async function () {
      const { core, usdc, buyer, seller, AMOUNT, DESC } =
        await loadFixture(deployFullFixture);

      await core
        .connect(buyer)
        .createEscrow(seller.address, AMOUNT, 0, true, 0, DESC);

      await usdc.mint(await core.getAddress(), AMOUNT * 2n);

      const tooMuch = ethers.parseUnits("900", 6); // 90% > 80%
      await expect(
        core.connect(seller).borrowAgainstEscrow(1, tooMuch)
      ).to.be.revertedWithCustomError(core, "BorrowLimitExceeded");
    });

    it("reverts if cumulative borrows exceed LTV", async function () {
      const { core, usdc, buyer, seller, AMOUNT, DESC } =
        await loadFixture(deployFullFixture);

      await core
        .connect(buyer)
        .createEscrow(seller.address, AMOUNT, 0, true, 0, DESC);

      await usdc.mint(await core.getAddress(), AMOUNT * 2n);

      await core
        .connect(seller)
        .borrowAgainstEscrow(1, ethers.parseUnits("700", 6));

      // Second borrow pushes over 80%
      await expect(
        core
          .connect(seller)
          .borrowAgainstEscrow(1, ethers.parseUnits("200", 6))
      ).to.be.revertedWithCustomError(core, "BorrowLimitExceeded");
    });

    it("reverts if yield not enabled", async function () {
      const { core, buyer, seller, AMOUNT, DESC } =
        await loadFixture(deployFullFixture);

      await core
        .connect(buyer)
        .createEscrow(seller.address, AMOUNT, 0, false, 0, DESC);

      await expect(
        core
          .connect(seller)
          .borrowAgainstEscrow(1, ethers.parseUnits("100", 6))
      ).to.be.revertedWithCustomError(core, "InvalidAmount");
    });

    it("reverts if not NFT owner", async function () {
      const { core, usdc, buyer, seller, stranger, AMOUNT, DESC } =
        await loadFixture(deployFullFixture);

      await core
        .connect(buyer)
        .createEscrow(seller.address, AMOUNT, 0, true, 0, DESC);

      await usdc.mint(await core.getAddress(), AMOUNT * 2n);

      await expect(
        core
          .connect(stranger)
          .borrowAgainstEscrow(1, ethers.parseUnits("100", 6))
      ).to.be.revertedWithCustomError(core, "Unauthorized");
    });

    it("repay reduces debt correctly", async function () {
      const { core, usdc, buyer, seller, AMOUNT, DESC } =
        await loadFixture(deployFullFixture);

      await core
        .connect(buyer)
        .createEscrow(seller.address, AMOUNT, 0, true, 0, DESC);

      await usdc.mint(await core.getAddress(), AMOUNT * 2n);

      const borrowAmt = ethers.parseUnits("500", 6);
      await core.connect(seller).borrowAgainstEscrow(1, borrowAmt);

      const repayAmt = ethers.parseUnits("200", 6);
      await core.connect(seller).repayBorrow(1, repayAmt);

      expect(await core.getDebt(1)).to.equal(borrowAmt - repayAmt);
    });

    it("emits BorrowRepaid event", async function () {
      const { core, usdc, buyer, seller, AMOUNT, DESC } =
        await loadFixture(deployFullFixture);

      await core
        .connect(buyer)
        .createEscrow(seller.address, AMOUNT, 0, true, 0, DESC);

      await usdc.mint(await core.getAddress(), AMOUNT * 2n);

      const borrowAmt = ethers.parseUnits("500", 6);
      await core.connect(seller).borrowAgainstEscrow(1, borrowAmt);

      const repayAmt = ethers.parseUnits("200", 6);
      await expect(core.connect(seller).repayBorrow(1, repayAmt))
        .to.emit(core, "BorrowRepaid")
        .withArgs(1, repayAmt);
    });

    it("repay reverts if repayAmount is 0", async function () {
      const { core, usdc, buyer, seller, AMOUNT, DESC } =
        await loadFixture(deployFullFixture);

      await core
        .connect(buyer)
        .createEscrow(seller.address, AMOUNT, 0, true, 0, DESC);

      await usdc.mint(await core.getAddress(), AMOUNT * 2n);

      await core
        .connect(seller)
        .borrowAgainstEscrow(1, ethers.parseUnits("100", 6));

      await expect(
        core.connect(seller).repayBorrow(1, 0)
      ).to.be.revertedWithCustomError(core, "InvalidAmount");
    });

    it("repay reverts if repayAmount > debt", async function () {
      const { core, usdc, buyer, seller, AMOUNT, DESC } =
        await loadFixture(deployFullFixture);

      await core
        .connect(buyer)
        .createEscrow(seller.address, AMOUNT, 0, true, 0, DESC);

      await usdc.mint(await core.getAddress(), AMOUNT * 2n);

      const borrowAmt = ethers.parseUnits("100", 6);
      await core.connect(seller).borrowAgainstEscrow(1, borrowAmt);

      await expect(
        core
          .connect(seller)
          .repayBorrow(1, ethers.parseUnits("200", 6))
      ).to.be.revertedWithCustomError(core, "InvalidAmount");
    });

    it("cannot refund with outstanding debt", async function () {
      const { core, usdc, buyer, seller, AMOUNT, DESC } =
        await loadFixture(deployFullFixture);

      await core
        .connect(buyer)
        .createEscrow(seller.address, AMOUNT, 0, true, 0, DESC);

      await usdc.mint(await core.getAddress(), AMOUNT * 2n);

      await core
        .connect(seller)
        .borrowAgainstEscrow(1, ethers.parseUnits("100", 6));

      await expect(
        core.connect(buyer).refundEscrow(1)
      ).to.be.revertedWithCustomError(core, "OutstandingDebt");
    });

    it("can refund after full repayment", async function () {
      const { core, usdc, yieldVault, buyer, seller, AMOUNT, DESC } =
        await loadFixture(deployFullFixture);

      await core
        .connect(buyer)
        .createEscrow(seller.address, AMOUNT, 0, true, 0, DESC);

      await usdc.mint(await core.getAddress(), AMOUNT * 2n);
      await usdc.mint(
        await yieldVault.getAddress(),
        ethers.parseUnits("100", 6)
      );

      const borrowAmt = ethers.parseUnits("100", 6);
      await core.connect(seller).borrowAgainstEscrow(1, borrowAmt);

      // Repay in full
      await core.connect(seller).repayBorrow(1, borrowAmt);
      expect(await core.getDebt(1)).to.equal(0);

      // Now refund should work
      await expect(core.connect(buyer).refundEscrow(1)).to.emit(
        core,
        "EscrowRefunded"
      );
    });
  });

  // ════════════════════════════════════════════════════════════════
  //  ComplianceOracle
  // ════════════════════════════════════════════════════════════════

  describe("ComplianceOracle", function () {
    it("blocks blacklisted addresses", async function () {
      const { oracle, owner, buyer } = await loadFixture(deployFullFixture);

      await oracle.connect(owner).addToBlacklist(buyer.address);

      const [allowed, reason] = await oracle.check(
        buyer.address,
        ethers.parseUnits("100", 6)
      );
      expect(allowed).to.be.false;
      expect(reason).to.equal("blacklisted");
      expect(await oracle.isBlacklisted(buyer.address)).to.be.true;
    });

    it("unblacklisting restores access", async function () {
      const { oracle, owner, buyer } = await loadFixture(deployFullFixture);

      await oracle.connect(owner).addToBlacklist(buyer.address);
      await oracle.connect(owner).removeFromBlacklist(buyer.address);

      const [allowed] = await oracle.check(
        buyer.address,
        ethers.parseUnits("100", 6)
      );
      expect(allowed).to.be.true;
      expect(await oracle.isBlacklisted(buyer.address)).to.be.false;
    });

    it("enforces KYC tx limits per level", async function () {
      const { oracle, buyer } = await loadFixture(deployFullFixture);

      // Basic limit = 1,000 USDC
      const [allowedUnder] = await oracle.check(
        buyer.address,
        ethers.parseUnits("999", 6)
      );
      expect(allowedUnder).to.be.true;

      const [allowedAt] = await oracle.check(
        buyer.address,
        ethers.parseUnits("1000", 6)
      );
      expect(allowedAt).to.be.true;

      const [allowedOver, reason] = await oracle.check(
        buyer.address,
        ethers.parseUnits("1001", 6)
      );
      expect(allowedOver).to.be.false;
      expect(reason).to.equal("exceeds tx limit");
    });

    it("None KYC rejects any positive amount", async function () {
      const { oracle, blacklisted } = await loadFixture(deployFullFixture);

      const [allowed, reason] = await oracle.check(blacklisted.address, 1);
      expect(allowed).to.be.false;
      expect(reason).to.equal("kyc required");
    });

    it("None KYC allows zero amount", async function () {
      const { oracle, blacklisted } = await loadFixture(deployFullFixture);

      const [allowed] = await oracle.check(blacklisted.address, 0);
      expect(allowed).to.be.true;
    });

    it("Advanced KYC has higher limit", async function () {
      const { oracle, owner } = await loadFixture(deployFullFixture);

      // owner is Advanced KYC (limit 100,000)
      const [allowed] = await oracle.check(
        owner.address,
        ethers.parseUnits("50000", 6)
      );
      expect(allowed).to.be.true;
    });

    it("blocks high AML score users (>= 75)", async function () {
      const { oracle, owner, buyer } = await loadFixture(deployFullFixture);

      await oracle.connect(owner).setAmlScore(buyer.address, 75);
      const [allowed75, reason75] = await oracle.check(
        buyer.address,
        ethers.parseUnits("100", 6)
      );
      expect(allowed75).to.be.false;
      expect(reason75).to.equal("aml flagged");

      // Score 74 should pass
      await oracle.connect(owner).setAmlScore(buyer.address, 74);
      const [allowed74] = await oracle.check(
        buyer.address,
        ethers.parseUnits("100", 6)
      );
      expect(allowed74).to.be.true;
    });

    it("emits KycSet event", async function () {
      const { oracle, owner, stranger } = await loadFixture(deployFullFixture);

      await expect(oracle.connect(owner).setKycLevel(stranger.address, 2))
        .to.emit(oracle, "KycSet")
        .withArgs(stranger.address, 2);
    });

    it("emits AmlScoreSet event", async function () {
      const { oracle, owner, buyer } = await loadFixture(deployFullFixture);

      await expect(oracle.connect(owner).setAmlScore(buyer.address, 50))
        .to.emit(oracle, "AmlScoreSet")
        .withArgs(buyer.address, 50);
    });

    it("emits Blacklisted and Removed events", async function () {
      const { oracle, owner, buyer } = await loadFixture(deployFullFixture);

      await expect(oracle.connect(owner).addToBlacklist(buyer.address))
        .to.emit(oracle, "Blacklisted")
        .withArgs(buyer.address);

      await expect(oracle.connect(owner).removeFromBlacklist(buyer.address))
        .to.emit(oracle, "Removed")
        .withArgs(buyer.address);
    });

    it("batch KYC reverts on length mismatch", async function () {
      const { oracle, owner, buyer, seller } =
        await loadFixture(deployFullFixture);

      await expect(
        oracle
          .connect(owner)
          .batchSetKycLevel([buyer.address, seller.address], [1])
      ).to.be.revertedWith("length mismatch");
    });

    it("AML score rejects > 100", async function () {
      const { oracle, owner, buyer } = await loadFixture(deployFullFixture);

      await expect(
        oracle.connect(owner).setAmlScore(buyer.address, 101)
      ).to.be.revertedWith("score must be 0-100");
    });

    it("only owner can set KYC", async function () {
      const { oracle, buyer, seller } = await loadFixture(deployFullFixture);

      await expect(
        oracle.connect(buyer).setKycLevel(seller.address, 2)
      ).to.be.revertedWithCustomError(oracle, "OwnableUnauthorizedAccount");
    });

    it("owner can update tx limits", async function () {
      const { oracle, owner } = await loadFixture(deployFullFixture);

      await oracle
        .connect(owner)
        .setTxLimit(1, ethers.parseUnits("5000", 6)); // Basic → 5000

      expect(await oracle.txLimit(1)).to.equal(ethers.parseUnits("5000", 6));
    });
  });

  // ════════════════════════════════════════════════════════════════
  //  XCMYieldVault
  // ════════════════════════════════════════════════════════════════

  describe("XCMYieldVault", function () {
    it("simulated yield accrues correctly over time", async function () {
      const { core, yieldVault, buyer, seller, AMOUNT, DESC } =
        await loadFixture(deployFullFixture);

      await core
        .connect(buyer)
        .createEscrow(seller.address, AMOUNT, 0, true, 0, DESC);

      // 5% APY for 365 days = 50 USDC on 1000
      await time.increase(365 * 24 * 3600);

      const preview = await yieldVault.previewYield(1);
      // Expected: 1000e6 * 500 / 10000 = 50e6 (50 USDC for 1 year)
      expect(preview).to.be.closeTo(
        ethers.parseUnits("50", 6),
        ethers.parseUnits("0.5", 6) // small rounding tolerance
      );
    });

    it("yield accrues proportionally for shorter periods", async function () {
      const { core, yieldVault, buyer, seller, AMOUNT, DESC } =
        await loadFixture(deployFullFixture);

      await core
        .connect(buyer)
        .createEscrow(seller.address, AMOUNT, 0, true, 0, DESC);

      // 90 days ≈ 12.33 USDC
      await time.increase(90 * 24 * 3600);

      const preview = await yieldVault.previewYield(1);
      const expected = (AMOUNT * 500n * BigInt(90 * 24 * 3600)) /
        (10000n * BigInt(365 * 24 * 3600));
      expect(preview).to.be.closeTo(expected, ethers.parseUnits("0.1", 6));
    });

    it("reclaim returns principal + yield", async function () {
      const { core, usdc, yieldVault, buyer, seller, AMOUNT, DESC } =
        await loadFixture(deployFullFixture);

      await core
        .connect(buyer)
        .createEscrow(seller.address, AMOUNT, 0, true, 0, DESC);

      // Seed vault with extra for yield
      await usdc.mint(
        await yieldVault.getAddress(),
        ethers.parseUnits("100", 6)
      );

      await time.increase(30 * 24 * 3600);

      const sellerBefore = await usdc.balanceOf(seller.address);
      await core.connect(buyer).releaseEscrow(1);
      const sellerAfter = await usdc.balanceOf(seller.address);

      // Should be > principal - fee (because yield added)
      const fee = (AMOUNT * 50n) / 10000n;
      expect(sellerAfter - sellerBefore).to.be.gt(AMOUNT - fee);
    });

    it("preview yield matches actual reclaim (within rounding)", async function () {
      const { core, usdc, yieldVault, buyer, seller, AMOUNT, DESC } =
        await loadFixture(deployFullFixture);

      await core
        .connect(buyer)
        .createEscrow(seller.address, AMOUNT, 0, true, 0, DESC);

      await usdc.mint(
        await yieldVault.getAddress(),
        ethers.parseUnits("100", 6)
      );

      await time.increase(60 * 24 * 3600);

      const preview = await core.previewYield(1);

      // Release and check actual yield from event
      const tx = await core.connect(buyer).releaseEscrow(1);
      const receipt = await tx.wait();
      const event = receipt.logs.find((log) => {
        try {
          return core.interface.parseLog(log)?.name === "EscrowReleased";
        } catch {
          return false;
        }
      });
      const parsed = core.interface.parseLog(event);
      const actualYield = parsed.args[3]; // yield parameter

      // Preview was computed before release tx, actual is during release tx
      // Allow 1 second of additional accrual tolerance
      const tolerance =
        (AMOUNT * 500n) / (10000n * BigInt(365 * 24 * 3600)); // ~1 second
      expect(actualYield).to.be.closeTo(preview, tolerance * 2n);
    });

    it("preview returns 0 for non-active yield", async function () {
      const { core, buyer, seller, AMOUNT, DESC } =
        await loadFixture(deployFullFixture);

      // Non-yield escrow
      await core
        .connect(buyer)
        .createEscrow(seller.address, AMOUNT, 0, false, 0, DESC);

      expect(await core.previewYield(1)).to.equal(0);
    });

    it("only core can deploy yield", async function () {
      const { yieldVault, buyer } = await loadFixture(deployFullFixture);

      await expect(
        yieldVault.connect(buyer).deployYield(1, 1000)
      ).to.be.revertedWithCustomError(yieldVault, "NotCore");
    });

    it("only core can reclaim yield", async function () {
      const { yieldVault, buyer } = await loadFixture(deployFullFixture);

      await expect(
        yieldVault.connect(buyer).reclaimYield(1)
      ).to.be.revertedWithCustomError(yieldVault, "NotCore");
    });

    it("owner can set simulated APY", async function () {
      const { yieldVault, owner } = await loadFixture(deployFullFixture);

      await yieldVault.connect(owner).setSimulatedApyBps(1000);
      expect(await yieldVault.simulatedApyBps()).to.equal(1000);
    });

    it("rejects APY above 20%", async function () {
      const { yieldVault, owner } = await loadFixture(deployFullFixture);

      await expect(
        yieldVault.connect(owner).setSimulatedApyBps(2001)
      ).to.be.revertedWith("max 20% APY");
    });

    it("owner can toggle real XCM mode", async function () {
      const { yieldVault, owner } = await loadFixture(deployFullFixture);

      await yieldVault.connect(owner).setUseRealXcm(true);
      expect(await yieldVault.useRealXcm()).to.be.true;

      await yieldVault.connect(owner).setUseRealXcm(false);
      expect(await yieldVault.useRealXcm()).to.be.false;
    });

    it("emits YieldDeployed on deposit", async function () {
      const { core, yieldVault, buyer, seller, AMOUNT, DESC } =
        await loadFixture(deployFullFixture);

      await expect(
        core
          .connect(buyer)
          .createEscrow(seller.address, AMOUNT, 0, true, 0, DESC)
      ).to.emit(yieldVault, "YieldDeployed");
    });
  });

  // ════════════════════════════════════════════════════════════════
  //  FiatSettlement
  // ════════════════════════════════════════════════════════════════

  describe("FiatSettlement", function () {
    it("queues settlement with valid Stellar address via PendulumFiat rail", async function () {
      const { core, nft, fiatSettlement, buyer, seller, AMOUNT, DESC, STELLAR_ADDR } =
        await loadFixture(deployFullFixture);

      // Create escrow with PendulumFiat rail (2)
      await core
        .connect(buyer)
        .createEscrow(seller.address, AMOUNT, 0, false, 2, DESC);

      // Seller sets fiat details
      await core.connect(seller).setFiatDetails(1, STELLAR_ADDR, 0); // NGN

      // Release triggers fiat settlement
      await expect(core.connect(buyer).releaseEscrow(1)).to.emit(
        fiatSettlement,
        "SettlementQueued"
      );
    });

    it("reverts on invalid Stellar address format (too short)", async function () {
      const { core, buyer, seller, AMOUNT, DESC } =
        await loadFixture(deployFullFixture);

      await core
        .connect(buyer)
        .createEscrow(seller.address, AMOUNT, 0, false, 2, DESC);

      const badAddr = ethers.toUtf8Bytes("GABCDEF"); // too short
      await expect(
        core.connect(seller).setFiatDetails(1, badAddr, 0)
      ).to.be.revertedWithCustomError(core, "InvalidStellarAddress");
    });

    it("reverts on invalid Stellar address format (wrong prefix)", async function () {
      const { core, buyer, seller, AMOUNT, DESC } =
        await loadFixture(deployFullFixture);

      await core
        .connect(buyer)
        .createEscrow(seller.address, AMOUNT, 0, false, 2, DESC);

      // 56 bytes but doesn't start with G (0x47)
      const badAddr = ethers.toUtf8Bytes(
        "XABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUV"
      );
      await expect(
        core.connect(seller).setFiatDetails(1, badAddr, 0)
      ).to.be.revertedWithCustomError(core, "InvalidStellarAddress");
    });

    it("reverts if release with PendulumFiat but no fiat details set", async function () {
      const { core, buyer, seller, AMOUNT, DESC } =
        await loadFixture(deployFullFixture);

      await core
        .connect(buyer)
        .createEscrow(seller.address, AMOUNT, 0, false, 2, DESC);

      // Don't set fiat details — should revert on release
      await expect(
        core.connect(buyer).releaseEscrow(1)
      ).to.be.revertedWithCustomError(core, "InvalidStellarAddress");
    });

    it("only core can initiate settlement", async function () {
      const { fiatSettlement, buyer, STELLAR_ADDR } =
        await loadFixture(deployFullFixture);

      await expect(
        fiatSettlement
          .connect(buyer)
          .initiateFiatSettlement(1, STELLAR_ADDR, 1000, 0)
      ).to.be.revertedWithCustomError(fiatSettlement, "NotCore");
    });

    it("owner can mark settlement completed", async function () {
      const { core, fiatSettlement, owner, buyer, seller, AMOUNT, DESC, STELLAR_ADDR } =
        await loadFixture(deployFullFixture);

      await core
        .connect(buyer)
        .createEscrow(seller.address, AMOUNT, 0, false, 2, DESC);

      await core.connect(seller).setFiatDetails(1, STELLAR_ADDR, 0);
      await core.connect(buyer).releaseEscrow(1);

      await expect(fiatSettlement.connect(owner).markCompleted(0))
        .to.emit(fiatSettlement, "SettlementCompleted")
        .withArgs(0);

      const settlement = await fiatSettlement.getSettlement(0);
      expect(settlement.completed).to.be.true;
    });

    it("stores correct settlement details", async function () {
      const { core, fiatSettlement, buyer, seller, AMOUNT, DESC, STELLAR_ADDR } =
        await loadFixture(deployFullFixture);

      await core
        .connect(buyer)
        .createEscrow(seller.address, AMOUNT, 0, false, 2, DESC);

      await core.connect(seller).setFiatDetails(1, STELLAR_ADDR, 1); // KES

      await core.connect(buyer).releaseEscrow(1);

      const settlement = await fiatSettlement.getSettlement(0);
      expect(settlement.escrowId).to.equal(1);
      expect(settlement.corridor).to.equal(1); // KES
      expect(settlement.completed).to.be.false;
      expect(settlement.amount).to.be.gt(0);
    });
  });

  // ════════════════════════════════════════════════════════════════
  //  Admin Functions
  // ════════════════════════════════════════════════════════════════

  describe("Admin Functions", function () {
    it("owner can pause and unpause", async function () {
      const { core, owner, buyer, seller, AMOUNT, DESC } =
        await loadFixture(deployFullFixture);

      await core.connect(owner).emergencyPause();

      await expect(
        core
          .connect(buyer)
          .createEscrow(seller.address, AMOUNT, 0, false, 0, DESC)
      ).to.be.revertedWithCustomError(core, "EnforcedPause");

      await core.connect(owner).unpause();

      await expect(
        core
          .connect(buyer)
          .createEscrow(seller.address, AMOUNT, 0, false, 0, DESC)
      ).to.emit(core, "EscrowCreated");
    });

    it("non-owner cannot pause", async function () {
      const { core, buyer } = await loadFixture(deployFullFixture);

      await expect(
        core.connect(buyer).emergencyPause()
      ).to.be.revertedWithCustomError(core, "OwnableUnauthorizedAccount");
    });

    it("non-owner cannot unpause", async function () {
      const { core, owner, buyer } = await loadFixture(deployFullFixture);

      await core.connect(owner).emergencyPause();

      await expect(
        core.connect(buyer).unpause()
      ).to.be.revertedWithCustomError(core, "OwnableUnauthorizedAccount");
    });

    it("owner can set fee recipient", async function () {
      const { core, owner, factorBuyer } = await loadFixture(deployFullFixture);

      await core.connect(owner).setFeeRecipient(factorBuyer.address);
      expect(await core.feeRecipient()).to.equal(factorBuyer.address);
    });

    it("rejects zero address as fee recipient", async function () {
      const { core, owner } = await loadFixture(deployFullFixture);

      await expect(
        core.connect(owner).setFeeRecipient(ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(core, "Unauthorized");
    });

    it("non-owner cannot set fee recipient", async function () {
      const { core, buyer, seller } = await loadFixture(deployFullFixture);

      await expect(
        core.connect(buyer).setFeeRecipient(seller.address)
      ).to.be.revertedWithCustomError(core, "OwnableUnauthorizedAccount");
    });

    it("owner can rescue ERC20", async function () {
      const { core, usdc, owner } = await loadFixture(deployFullFixture);

      const rescueAmount = ethers.parseUnits("100", 6);
      await usdc.mint(await core.getAddress(), rescueAmount);

      const ownerBefore = await usdc.balanceOf(owner.address);
      await core
        .connect(owner)
        .rescueERC20(await usdc.getAddress(), rescueAmount);
      const ownerAfter = await usdc.balanceOf(owner.address);

      expect(ownerAfter - ownerBefore).to.equal(rescueAmount);
    });

    it("non-owner cannot rescue ERC20", async function () {
      const { core, usdc, buyer } = await loadFixture(deployFullFixture);

      await expect(
        core
          .connect(buyer)
          .rescueERC20(await usdc.getAddress(), ethers.parseUnits("1", 6))
      ).to.be.revertedWithCustomError(core, "OwnableUnauthorizedAccount");
    });

    it("paused state blocks all user state-changing functions", async function () {
      const { core, owner, buyer, seller, AMOUNT, DESC } =
        await loadFixture(deployFullFixture);

      // Create an escrow first, then pause
      await core
        .connect(buyer)
        .createEscrow(seller.address, AMOUNT, 0, false, 0, DESC);

      await core.connect(owner).emergencyPause();

      await expect(
        core.connect(buyer).releaseEscrow(1)
      ).to.be.revertedWithCustomError(core, "EnforcedPause");

      await expect(
        core.connect(buyer).refundEscrow(1)
      ).to.be.revertedWithCustomError(core, "EnforcedPause");

      await expect(
        core.connect(buyer).disputeEscrow(1)
      ).to.be.revertedWithCustomError(core, "EnforcedPause");

      await expect(
        core.connect(seller).listInvoice(1, AMOUNT / 2n)
      ).to.be.revertedWithCustomError(core, "EnforcedPause");
    });
  });

  // ════════════════════════════════════════════════════════════════
  //  View Helpers
  // ════════════════════════════════════════════════════════════════

  describe("View Helpers", function () {
    it("getEscrow returns full struct", async function () {
      const { core, buyer, seller, AMOUNT, DESC } =
        await loadFixture(deployFullFixture);

      await core
        .connect(buyer)
        .createEscrow(seller.address, AMOUNT, 0, false, 0, DESC);

      const e = await core.getEscrow(1);
      expect(e.id).to.equal(1);
      expect(e.buyer).to.equal(buyer.address);
      expect(e.seller).to.equal(seller.address);
      expect(e.amount).to.equal(AMOUNT);
      expect(e.yieldAccrued).to.equal(0);
      expect(e.createdAt).to.be.gt(0);
      expect(e.releasedAt).to.equal(0);
      expect(e.deadline).to.equal(0);
      expect(e.status).to.equal(0);
      expect(e.rail).to.equal(0);
      expect(e.yieldEnabled).to.be.false;
      expect(e.nftTokenId).to.equal(1);
      expect(e.description).to.equal(DESC);
    });

    it("getListing returns full struct", async function () {
      const { core, buyer, seller, AMOUNT, DESC } =
        await loadFixture(deployFullFixture);

      await core
        .connect(buyer)
        .createEscrow(seller.address, AMOUNT, 0, false, 0, DESC);

      const listPrice = (AMOUNT * 85n) / 100n;
      await core.connect(seller).listInvoice(1, listPrice);

      const l = await core.getListing(0);
      expect(l.escrowId).to.equal(1);
      expect(l.tokenId).to.equal(1);
      expect(l.seller).to.equal(seller.address);
      expect(l.listPrice).to.equal(listPrice);
      expect(l.faceValue).to.equal(AMOUNT);
      expect(l.active).to.be.true;
    });

    it("getBorrowLimit returns correct value", async function () {
      const { core, buyer, seller, AMOUNT, DESC } =
        await loadFixture(deployFullFixture);

      await core
        .connect(buyer)
        .createEscrow(seller.address, AMOUNT, 0, true, 0, DESC);

      expect(await core.getBorrowLimit(1)).to.equal(
        (AMOUNT * 8000n) / 10000n
      );
    });

    it("getBorrowLimit returns 0 when fully borrowed", async function () {
      const { core, usdc, buyer, seller, AMOUNT, DESC } =
        await loadFixture(deployFullFixture);

      await core
        .connect(buyer)
        .createEscrow(seller.address, AMOUNT, 0, true, 0, DESC);

      await usdc.mint(await core.getAddress(), AMOUNT * 2n);

      const maxBorrow = (AMOUNT * 8000n) / 10000n;
      await core.connect(seller).borrowAgainstEscrow(1, maxBorrow);

      expect(await core.getBorrowLimit(1)).to.equal(0);
    });

    it("getDebt returns 0 for escrow with no borrowing", async function () {
      const { core, buyer, seller, AMOUNT, DESC } =
        await loadFixture(deployFullFixture);

      await core
        .connect(buyer)
        .createEscrow(seller.address, AMOUNT, 0, false, 0, DESC);

      expect(await core.getDebt(1)).to.equal(0);
    });
  });
});
