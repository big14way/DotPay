const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture, time } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

describe("DotPay", function () {
  async function deployFixture() {
    const [owner, buyer, seller, feeRecipient, factorBuyer, blacklisted] =
      await ethers.getSigners();

    // Deploy MockUSDC
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    const usdc = await MockUSDC.deploy();

    // Deploy ComplianceOracle
    const ComplianceOracle = await ethers.getContractFactory("ComplianceOracle");
    const oracle = await ComplianceOracle.deploy(owner.address);

    // Deploy XCMYieldVault
    const XCMYieldVault = await ethers.getContractFactory("XCMYieldVault");
    const yieldVault = await XCMYieldVault.deploy(
      await usdc.getAddress(),
      owner.address
    );

    // Deploy FiatSettlement
    const FiatSettlement = await ethers.getContractFactory("FiatSettlement");
    const fiatSettlement = await FiatSettlement.deploy(
      await usdc.getAddress(),
      owner.address
    );

    // We need to deploy InvoiceNFT with a temporary minter, then update
    // after InvoiceCore is deployed
    const InvoiceNFT = await ethers.getContractFactory("InvoiceNFT");
    const nft = await InvoiceNFT.deploy(owner.address, owner.address);

    // Deploy InvoiceCore
    const InvoiceCore = await ethers.getContractFactory("InvoiceCore");
    const core = await InvoiceCore.deploy(
      await usdc.getAddress(),
      await nft.getAddress(),
      await oracle.getAddress(),
      await yieldVault.getAddress(),
      await fiatSettlement.getAddress(),
      feeRecipient.address
    );

    // Set InvoiceCore as the minter on InvoiceNFT
    await nft.setMinter(await core.getAddress());

    // Set InvoiceCore as the core contract on YieldVault and FiatSettlement
    await yieldVault.setCoreContract(await core.getAddress());
    await fiatSettlement.setCoreContract(await core.getAddress());

    // KYC setup: set buyer, seller, factorBuyer to Basic KYC
    await oracle.setKycLevel(buyer.address, 1); // Basic
    await oracle.setKycLevel(seller.address, 1);
    await oracle.setKycLevel(factorBuyer.address, 1);

    // Mint USDC to buyer and factorBuyer
    const AMOUNT = ethers.parseUnits("1000", 6); // 1000 USDC
    await usdc.mint(buyer.address, AMOUNT * 10n);
    await usdc.mint(factorBuyer.address, AMOUNT * 10n);

    // Approve core contract to spend buyer's USDC
    await usdc.connect(buyer).approve(await core.getAddress(), ethers.MaxUint256);
    await usdc
      .connect(factorBuyer)
      .approve(await core.getAddress(), ethers.MaxUint256);

    return {
      usdc,
      oracle,
      yieldVault,
      fiatSettlement,
      nft,
      core,
      owner,
      buyer,
      seller,
      feeRecipient,
      factorBuyer,
      blacklisted,
      AMOUNT,
    };
  }

  /* ─── MockUSDC ──────────────────────────────────────────────── */

  describe("MockUSDC", function () {
    it("has 6 decimals", async function () {
      const { usdc } = await loadFixture(deployFixture);
      expect(await usdc.decimals()).to.equal(6);
    });

    it("faucet mints 10,000 USDC", async function () {
      const { usdc, blacklisted } = await loadFixture(deployFixture);
      await usdc.connect(blacklisted).faucet();
      expect(await usdc.balanceOf(blacklisted.address)).to.equal(
        ethers.parseUnits("10000", 6)
      );
    });
  });

  /* ─── ComplianceOracle ──────────────────────────────────────── */

  describe("ComplianceOracle", function () {
    it("rejects users with no KYC", async function () {
      const { oracle, blacklisted } = await loadFixture(deployFixture);
      const [allowed, reason] = await oracle.check(
        blacklisted.address,
        ethers.parseUnits("100", 6)
      );
      expect(allowed).to.be.false;
      expect(reason).to.equal("kyc required");
    });

    it("allows Basic KYC user under limit", async function () {
      const { oracle, buyer } = await loadFixture(deployFixture);
      const [allowed] = await oracle.check(
        buyer.address,
        ethers.parseUnits("500", 6)
      );
      expect(allowed).to.be.true;
    });

    it("rejects Basic KYC user over limit", async function () {
      const { oracle, buyer } = await loadFixture(deployFixture);
      const [allowed, reason] = await oracle.check(
        buyer.address,
        ethers.parseUnits("2000", 6)
      );
      expect(allowed).to.be.false;
      expect(reason).to.equal("exceeds tx limit");
    });

    it("rejects blacklisted user", async function () {
      const { oracle, owner, buyer } = await loadFixture(deployFixture);
      await oracle.connect(owner).addToBlacklist(buyer.address);
      const [allowed, reason] = await oracle.check(
        buyer.address,
        ethers.parseUnits("100", 6)
      );
      expect(allowed).to.be.false;
      expect(reason).to.equal("blacklisted");
    });

    it("rejects AML flagged user (score >= 75)", async function () {
      const { oracle, owner, buyer } = await loadFixture(deployFixture);
      await oracle.connect(owner).setAmlScore(buyer.address, 80);
      const [allowed, reason] = await oracle.check(
        buyer.address,
        ethers.parseUnits("100", 6)
      );
      expect(allowed).to.be.false;
      expect(reason).to.equal("aml flagged");
    });

    it("batch sets KYC levels", async function () {
      const { oracle, owner, blacklisted, seller } = await loadFixture(
        deployFixture
      );
      await oracle
        .connect(owner)
        .batchSetKycLevel([blacklisted.address, seller.address], [2, 3]);
      expect(await oracle.getKycLevel(blacklisted.address)).to.equal(2);
      expect(await oracle.getKycLevel(seller.address)).to.equal(3);
    });
  });

  /* ─── InvoiceNFT ────────────────────────────────────────────── */

  describe("InvoiceNFT", function () {
    it("only minter can mint", async function () {
      const { nft, buyer } = await loadFixture(deployFixture);
      await expect(
        nft.connect(buyer).mint(buyer.address, 1, "uri", 1)
      ).to.be.revertedWithCustomError(nft, "OnlyMinter");
    });

    it("tracks escrowId per tokenId", async function () {
      const { core, nft, buyer, seller, AMOUNT } = await loadFixture(
        deployFixture
      );
      await core
        .connect(buyer)
        .createEscrow(
          seller.address,
          AMOUNT,
          0,
          false,
          0,
          ethers.encodeBytes32String("test")
        );
      expect(await nft.escrowIdOf(1)).to.equal(1);
    });
  });

  /* ─── InvoiceCore — Escrow Creation ─────────────────────────── */

  describe("InvoiceCore - createEscrow", function () {
    it("creates an escrow and mints NFT to seller", async function () {
      const { core, nft, usdc, buyer, seller, AMOUNT } = await loadFixture(
        deployFixture
      );

      const tx = await core
        .connect(buyer)
        .createEscrow(
          seller.address,
          AMOUNT,
          0,
          false,
          0,
          ethers.encodeBytes32String("invoice-001")
        );

      await expect(tx).to.emit(core, "EscrowCreated");

      const escrow = await core.getEscrow(1);
      expect(escrow.buyer).to.equal(buyer.address);
      expect(escrow.seller).to.equal(seller.address);
      expect(escrow.amount).to.equal(AMOUNT);
      expect(escrow.status).to.equal(0); // Active

      // NFT minted to seller
      expect(await nft.ownerOf(1)).to.equal(seller.address);
    });

    it("reverts if amount is 0", async function () {
      const { core, buyer, seller } = await loadFixture(deployFixture);
      await expect(
        core
          .connect(buyer)
          .createEscrow(seller.address, 0, 0, false, 0, ethers.ZeroHash)
      ).to.be.revertedWithCustomError(core, "InvalidAmount");
    });

    it("reverts if seller is buyer", async function () {
      const { core, buyer, AMOUNT } = await loadFixture(deployFixture);
      await expect(
        core
          .connect(buyer)
          .createEscrow(buyer.address, AMOUNT, 0, false, 0, ethers.ZeroHash)
      ).to.be.revertedWithCustomError(core, "Unauthorized");
    });

    it("reverts if buyer has no KYC", async function () {
      const { core, blacklisted, seller, usdc, AMOUNT } = await loadFixture(
        deployFixture
      );
      await usdc.mint(blacklisted.address, AMOUNT);
      await usdc
        .connect(blacklisted)
        .approve(await core.getAddress(), ethers.MaxUint256);
      await expect(
        core
          .connect(blacklisted)
          .createEscrow(seller.address, AMOUNT, 0, false, 0, ethers.ZeroHash)
      ).to.be.revertedWithCustomError(core, "KycRequired");
    });

    it("reverts with expired deadline", async function () {
      const { core, buyer, seller, AMOUNT } = await loadFixture(deployFixture);
      const pastDeadline = (await time.latest()) - 100;
      await expect(
        core
          .connect(buyer)
          .createEscrow(
            seller.address,
            AMOUNT,
            pastDeadline,
            false,
            0,
            ethers.ZeroHash
          )
      ).to.be.revertedWithCustomError(core, "DeadlineExpired");
    });
  });

  /* ─── InvoiceCore — Escrow Release ──────────────────────────── */

  describe("InvoiceCore - releaseEscrow", function () {
    it("buyer releases escrow to seller", async function () {
      const { core, usdc, buyer, seller, feeRecipient, AMOUNT } =
        await loadFixture(deployFixture);

      await core
        .connect(buyer)
        .createEscrow(
          seller.address,
          AMOUNT,
          0,
          false,
          0,
          ethers.encodeBytes32String("test")
        );

      const sellerBalBefore = await usdc.balanceOf(seller.address);
      await core.connect(buyer).releaseEscrow(1);
      const sellerBalAfter = await usdc.balanceOf(seller.address);

      // 0.5% fee deducted
      const fee = (AMOUNT * 50n) / 10000n;
      const expectedPayout = AMOUNT - fee;

      expect(sellerBalAfter - sellerBalBefore).to.equal(expectedPayout);

      // Fee recipient got the fee
      expect(await usdc.balanceOf(feeRecipient.address)).to.equal(fee);

      // Escrow status is Released
      const escrow = await core.getEscrow(1);
      expect(escrow.status).to.equal(1); // Released
    });

    it("seller (NFT owner) can release", async function () {
      const { core, buyer, seller, AMOUNT } = await loadFixture(deployFixture);

      await core
        .connect(buyer)
        .createEscrow(
          seller.address,
          AMOUNT,
          0,
          false,
          0,
          ethers.encodeBytes32String("test")
        );

      await expect(core.connect(seller).releaseEscrow(1)).to.emit(
        core,
        "EscrowReleased"
      );
    });

    it("reverts if unauthorized user tries to release", async function () {
      const { core, buyer, seller, factorBuyer, AMOUNT } = await loadFixture(
        deployFixture
      );

      await core
        .connect(buyer)
        .createEscrow(
          seller.address,
          AMOUNT,
          0,
          false,
          0,
          ethers.encodeBytes32String("test")
        );

      await expect(
        core.connect(factorBuyer).releaseEscrow(1)
      ).to.be.revertedWithCustomError(core, "Unauthorized");
    });
  });

  /* ─── InvoiceCore — Escrow Refund ───────────────────────────── */

  describe("InvoiceCore - refundEscrow", function () {
    it("buyer refunds and gets USDC back", async function () {
      const { core, usdc, buyer, seller, AMOUNT } = await loadFixture(
        deployFixture
      );

      const balBefore = await usdc.balanceOf(buyer.address);

      await core
        .connect(buyer)
        .createEscrow(
          seller.address,
          AMOUNT,
          0,
          false,
          0,
          ethers.encodeBytes32String("test")
        );

      await core.connect(buyer).refundEscrow(1);

      const balAfter = await usdc.balanceOf(buyer.address);
      expect(balAfter).to.equal(balBefore);

      const escrow = await core.getEscrow(1);
      expect(escrow.status).to.equal(2); // Refunded
    });

    it("seller cannot refund", async function () {
      const { core, buyer, seller, AMOUNT } = await loadFixture(deployFixture);

      await core
        .connect(buyer)
        .createEscrow(
          seller.address,
          AMOUNT,
          0,
          false,
          0,
          ethers.encodeBytes32String("test")
        );

      await expect(
        core.connect(seller).refundEscrow(1)
      ).to.be.revertedWithCustomError(core, "Unauthorized");
    });
  });

  /* ─── InvoiceCore — Dispute ─────────────────────────────────── */

  describe("InvoiceCore - disputeEscrow", function () {
    it("buyer can dispute", async function () {
      const { core, buyer, seller, AMOUNT } = await loadFixture(deployFixture);

      await core
        .connect(buyer)
        .createEscrow(
          seller.address,
          AMOUNT,
          0,
          false,
          0,
          ethers.encodeBytes32String("test")
        );

      await expect(core.connect(buyer).disputeEscrow(1))
        .to.emit(core, "EscrowDisputed")
        .withArgs(1, buyer.address);

      const escrow = await core.getEscrow(1);
      expect(escrow.status).to.equal(3); // Disputed
    });

    it("seller can dispute", async function () {
      const { core, buyer, seller, AMOUNT } = await loadFixture(deployFixture);

      await core
        .connect(buyer)
        .createEscrow(
          seller.address,
          AMOUNT,
          0,
          false,
          0,
          ethers.encodeBytes32String("test")
        );

      await expect(core.connect(seller).disputeEscrow(1)).to.emit(
        core,
        "EscrowDisputed"
      );
    });
  });

  /* ─── InvoiceCore — Yield ───────────────────────────────────── */

  describe("InvoiceCore - Yield", function () {
    it("creates yield-enabled escrow and accrues simulated yield", async function () {
      const { core, yieldVault, buyer, seller, AMOUNT } = await loadFixture(
        deployFixture
      );

      await core
        .connect(buyer)
        .createEscrow(
          seller.address,
          AMOUNT,
          0,
          true,
          0,
          ethers.encodeBytes32String("yield-test")
        );

      // Advance time by 30 days
      await time.increase(30 * 24 * 3600);

      const yieldPreview = await core.previewYield(1);
      expect(yieldPreview).to.be.gt(0);

      // Yield should be approximately: 1000e6 * 500 * 30days / (10000 * 365days)
      // = 1000e6 * 500 * 2592000 / (10000 * 31536000)
      // ≈ 4109589 (≈4.1 USDC)
      expect(yieldPreview).to.be.closeTo(
        ethers.parseUnits("4.109", 6),
        ethers.parseUnits("0.1", 6)
      );
    });

    it("release with yield returns principal + yield minus fee", async function () {
      const { core, usdc, buyer, seller, feeRecipient, yieldVault, AMOUNT } =
        await loadFixture(deployFixture);

      await core
        .connect(buyer)
        .createEscrow(
          seller.address,
          AMOUNT,
          0,
          true,
          0,
          ethers.encodeBytes32String("yield-test")
        );

      // Seed the yield vault with extra USDC to cover simulated yield payouts
      await usdc.mint(await yieldVault.getAddress(), ethers.parseUnits("100", 6));

      await time.increase(30 * 24 * 3600);

      const sellerBalBefore = await usdc.balanceOf(seller.address);
      await core.connect(buyer).releaseEscrow(1);
      const sellerBalAfter = await usdc.balanceOf(seller.address);

      // Seller should get more than just AMOUNT minus fee (because of yield)
      const fee = (AMOUNT * 50n) / 10000n;
      const minExpected = AMOUNT - fee;
      expect(sellerBalAfter - sellerBalBefore).to.be.gt(minExpected);
    });
  });

  /* ─── InvoiceCore — Invoice Marketplace ─────────────────────── */

  describe("InvoiceCore - Invoice Marketplace", function () {
    it("seller lists and factor buyer purchases invoice", async function () {
      const { core, nft, usdc, buyer, seller, factorBuyer, AMOUNT } =
        await loadFixture(deployFixture);

      await core
        .connect(buyer)
        .createEscrow(
          seller.address,
          AMOUNT,
          0,
          false,
          0,
          ethers.encodeBytes32String("factoring-test")
        );

      // Seller lists at 90% of face value
      const listPrice = (AMOUNT * 90n) / 100n;
      await core.connect(seller).listInvoice(1, listPrice);

      const listing = await core.getListing(0);
      expect(listing.active).to.be.true;
      expect(listing.listPrice).to.equal(listPrice);

      // Factor buyer purchases
      const sellerBalBefore = await usdc.balanceOf(seller.address);

      // Need to approve NFT transfer
      await nft
        .connect(seller)
        .approve(await core.getAddress(), 1);

      await core.connect(factorBuyer).buyInvoice(0);

      const sellerBalAfter = await usdc.balanceOf(seller.address);
      expect(sellerBalAfter - sellerBalBefore).to.equal(listPrice);

      // NFT now owned by factorBuyer
      expect(await nft.ownerOf(1)).to.equal(factorBuyer.address);

      // factorBuyer can now release the escrow
      await expect(core.connect(factorBuyer).releaseEscrow(1)).to.emit(
        core,
        "EscrowReleased"
      );
    });

    it("reverts if listing price >= face value", async function () {
      const { core, buyer, seller, AMOUNT } = await loadFixture(deployFixture);

      await core
        .connect(buyer)
        .createEscrow(
          seller.address,
          AMOUNT,
          0,
          false,
          0,
          ethers.encodeBytes32String("test")
        );

      await expect(
        core.connect(seller).listInvoice(1, AMOUNT)
      ).to.be.revertedWithCustomError(core, "InvalidAmount");
    });

    it("reverts if already listed", async function () {
      const { core, buyer, seller, AMOUNT } = await loadFixture(deployFixture);

      await core
        .connect(buyer)
        .createEscrow(
          seller.address,
          AMOUNT,
          0,
          false,
          0,
          ethers.encodeBytes32String("test")
        );

      const listPrice = (AMOUNT * 90n) / 100n;
      await core.connect(seller).listInvoice(1, listPrice);

      await expect(
        core.connect(seller).listInvoice(1, listPrice)
      ).to.be.revertedWithCustomError(core, "AlreadyListed");
    });
  });

  /* ─── InvoiceCore — Borrowing ───────────────────────────────── */

  describe("InvoiceCore - Borrowing", function () {
    it("NFT owner borrows against yield-enabled escrow", async function () {
      const { core, usdc, buyer, seller, AMOUNT } = await loadFixture(
        deployFixture
      );

      await core
        .connect(buyer)
        .createEscrow(
          seller.address,
          AMOUNT,
          0,
          true,
          0,
          ethers.encodeBytes32String("borrow-test")
        );

      // Need USDC in the core contract for borrowing
      // The yield vault holds the funds, but we need liquidity in core
      // Let's mint some USDC to core for lending pool
      const coreAddr = await core.getAddress();
      await usdc.mint(coreAddr, AMOUNT * 2n);

      // Max borrow = 80% of 1000 = 800 USDC
      const borrowLimit = await core.getBorrowLimit(1);
      expect(borrowLimit).to.equal((AMOUNT * 8000n) / 10000n);

      const borrowAmount = ethers.parseUnits("500", 6);
      const sellerBalBefore = await usdc.balanceOf(seller.address);

      await core.connect(seller).borrowAgainstEscrow(1, borrowAmount);

      const sellerBalAfter = await usdc.balanceOf(seller.address);
      expect(sellerBalAfter - sellerBalBefore).to.equal(borrowAmount);

      expect(await core.getDebt(1)).to.equal(borrowAmount);

      // Borrow limit reduced
      const newLimit = await core.getBorrowLimit(1);
      expect(newLimit).to.equal((AMOUNT * 8000n) / 10000n - borrowAmount);
    });

    it("reverts if borrow exceeds LTV", async function () {
      const { core, usdc, buyer, seller, AMOUNT } = await loadFixture(
        deployFixture
      );

      await core
        .connect(buyer)
        .createEscrow(
          seller.address,
          AMOUNT,
          0,
          true,
          0,
          ethers.encodeBytes32String("test")
        );

      const coreAddr = await core.getAddress();
      await usdc.mint(coreAddr, AMOUNT * 2n);

      const tooMuch = ethers.parseUnits("900", 6); // 90% > 80% LTV
      await expect(
        core.connect(seller).borrowAgainstEscrow(1, tooMuch)
      ).to.be.revertedWithCustomError(core, "BorrowLimitExceeded");
    });

    it("repay reduces debt", async function () {
      const { core, usdc, buyer, seller, AMOUNT } = await loadFixture(
        deployFixture
      );

      await core
        .connect(buyer)
        .createEscrow(
          seller.address,
          AMOUNT,
          0,
          true,
          0,
          ethers.encodeBytes32String("test")
        );

      const coreAddr = await core.getAddress();
      await usdc.mint(coreAddr, AMOUNT * 2n);

      const borrowAmount = ethers.parseUnits("500", 6);
      await core.connect(seller).borrowAgainstEscrow(1, borrowAmount);

      // Seller repays half
      const repayAmount = ethers.parseUnits("250", 6);
      await usdc
        .connect(seller)
        .approve(await core.getAddress(), repayAmount);
      await core.connect(seller).repayBorrow(1, repayAmount);

      expect(await core.getDebt(1)).to.equal(borrowAmount - repayAmount);
    });

    it("cannot refund with outstanding debt", async function () {
      const { core, usdc, buyer, seller, AMOUNT } = await loadFixture(
        deployFixture
      );

      await core
        .connect(buyer)
        .createEscrow(
          seller.address,
          AMOUNT,
          0,
          true,
          0,
          ethers.encodeBytes32String("test")
        );

      const coreAddr = await core.getAddress();
      await usdc.mint(coreAddr, AMOUNT * 2n);

      await core
        .connect(seller)
        .borrowAgainstEscrow(1, ethers.parseUnits("100", 6));

      await expect(
        core.connect(buyer).refundEscrow(1)
      ).to.be.revertedWithCustomError(core, "OutstandingDebt");
    });
  });

  /* ─── Admin Functions ───────────────────────────────────────── */

  describe("InvoiceCore - Admin", function () {
    it("owner can pause and unpause", async function () {
      const { core, owner, buyer, seller, AMOUNT } = await loadFixture(
        deployFixture
      );

      await core.connect(owner).emergencyPause();

      await expect(
        core
          .connect(buyer)
          .createEscrow(
            seller.address,
            AMOUNT,
            0,
            false,
            0,
            ethers.ZeroHash
          )
      ).to.be.revertedWithCustomError(core, "EnforcedPause");

      await core.connect(owner).unpause();

      // Should work now
      await expect(
        core
          .connect(buyer)
          .createEscrow(
            seller.address,
            AMOUNT,
            0,
            false,
            0,
            ethers.encodeBytes32String("after-unpause")
          )
      ).to.emit(core, "EscrowCreated");
    });

    it("owner can set fee recipient", async function () {
      const { core, owner, factorBuyer } = await loadFixture(deployFixture);
      await core.connect(owner).setFeeRecipient(factorBuyer.address);
      expect(await core.feeRecipient()).to.equal(factorBuyer.address);
    });

    it("owner can rescue ERC20", async function () {
      const { core, usdc, owner } = await loadFixture(deployFixture);

      // Send some USDC directly to core
      const rescueAmount = ethers.parseUnits("100", 6);
      await usdc.mint(await core.getAddress(), rescueAmount);

      const ownerBalBefore = await usdc.balanceOf(owner.address);
      await core
        .connect(owner)
        .rescueERC20(await usdc.getAddress(), rescueAmount);
      const ownerBalAfter = await usdc.balanceOf(owner.address);

      expect(ownerBalAfter - ownerBalBefore).to.equal(rescueAmount);
    });
  });

  /* ─── XCMYieldVault ─────────────────────────────────────────── */

  describe("XCMYieldVault", function () {
    it("only core can deploy yield", async function () {
      const { yieldVault, buyer } = await loadFixture(deployFixture);
      await expect(
        yieldVault.connect(buyer).deployYield(1, 1000)
      ).to.be.revertedWithCustomError(yieldVault, "NotCore");
    });

    it("owner can set simulated APY", async function () {
      const { yieldVault, owner } = await loadFixture(deployFixture);
      await yieldVault.connect(owner).setSimulatedApyBps(1000); // 10%
      expect(await yieldVault.simulatedApyBps()).to.equal(1000);
    });

    it("rejects APY above 20%", async function () {
      const { yieldVault, owner } = await loadFixture(deployFixture);
      await expect(
        yieldVault.connect(owner).setSimulatedApyBps(2500)
      ).to.be.revertedWith("max 20% APY");
    });
  });

  /* ─── FiatSettlement ────────────────────────────────────────── */

  describe("FiatSettlement", function () {
    it("only core can initiate settlement", async function () {
      const { fiatSettlement, buyer } = await loadFixture(deployFixture);
      const stellarAddr = ethers.toUtf8Bytes(
        "GABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUV"
      );
      await expect(
        fiatSettlement
          .connect(buyer)
          .initiateFiatSettlement(1, stellarAddr, 1000, 0)
      ).to.be.revertedWithCustomError(fiatSettlement, "NotCore");
    });
  });
});
