// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IDotPay {

    /* ─── Enums ─────────────────────────────────────────────────── */

    enum EscrowStatus   { Active, Released, Refunded, Disputed, Liquidated }
    enum KycLevel       { None, Basic, Advanced, Institutional }
    enum SettlementRail { Direct, HydrationYield, PendulumFiat }

    /* ─── Structs ────────────────────────────────────────────────── */

    struct Escrow {
        uint256   id;
        address   buyer;
        address   seller;
        uint256   amount;         // USDC amount (6 decimals)
        uint256   yieldAccrued;   // yield earned while locked
        uint64    createdAt;
        uint64    releasedAt;
        uint64    deadline;       // unix ts; 0 = no deadline
        EscrowStatus status;
        SettlementRail rail;
        bool      yieldEnabled;
        uint256   nftTokenId;     // InvoiceNFT token ID
        bytes32   description;    // short descriptor hash
    }

    struct InvoiceListing {
        uint256  escrowId;
        uint256  tokenId;
        address  seller;
        uint256  listPrice;       // discounted ask price (USDC)
        uint256  faceValue;       // original escrow amount
        bool     active;
    }

    /* ─── Events ─────────────────────────────────────────────────── */

    event EscrowCreated(
        uint256 indexed id,
        address indexed buyer,
        address indexed seller,
        uint256 amount,
        uint256 nftTokenId,
        SettlementRail rail
    );
    event EscrowReleased(uint256 indexed id, address indexed recipient, uint256 amount, uint256 yield_);
    event EscrowRefunded(uint256 indexed id, address indexed buyer, uint256 amount);
    event EscrowDisputed(uint256 indexed id, address indexed initiator);
    event InvoiceListed(uint256 indexed escrowId, uint256 indexed tokenId, uint256 listPrice);
    event InvoiceSold(uint256 indexed escrowId, uint256 indexed tokenId, address indexed buyer, uint256 price);
    event YieldRouted(uint256 indexed escrowId, bytes xcmPayload);
    event FiatSettlementInitiated(uint256 indexed escrowId, bytes stellarAddress, uint256 amount);
    event KycUpdated(address indexed user, KycLevel level);
    event BorrowTaken(uint256 indexed escrowId, address indexed borrower, uint256 amount);
    event BorrowRepaid(uint256 indexed escrowId, uint256 amount);

    /* ─── Custom errors ──────────────────────────────────────────── */

    error Unauthorized();
    error InvalidAmount();
    error EscrowNotActive();
    error DeadlineExpired();
    error InsufficientAllowance();
    error KycRequired();
    error ExceedsLimit();
    error InvoiceNotListed();
    error BorrowLimitExceeded();
    error OutstandingDebt();
    error InvalidStellarAddress();
    error XcmFailed();
    error AlreadyListed();
    error TransferFailed();
}
