// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20Minimal} from "./interfaces/IERC20Minimal.sol";
import {IDotPay} from "./interfaces/IDotPay.sol";
import {InvoiceNFT} from "./InvoiceNFT.sol";

/// @title InvoiceMarket
/// @author DotPay
/// @notice Invoice factoring marketplace and borrowing against escrow.
///         Split from InvoiceCore for PolkaVM size limits.
contract InvoiceMarket is IDotPay, Ownable, Pausable, ReentrancyGuard {

    /* ─── State Variables ────────────────────────────────────────── */

    mapping(uint256 => InvoiceListing) public listings;
    uint256 public nextListingId;

    mapping(uint256 => bool) private _escrowListed;

    uint256 public constant LTV_BPS = 8000;

    IERC20Minimal public usdc;
    InvoiceNFT public nft;

    /// @notice Interface to EscrowCore for escrow reads and debt management.
    IEscrowCore public escrowCore;

    /* ─── Constructor ────────────────────────────────────────────── */

    constructor(
        address _usdc,
        address _nft,
        address _escrowCore
    ) Ownable(msg.sender) {
        usdc = IERC20Minimal(_usdc);
        nft = InvoiceNFT(_nft);
        escrowCore = IEscrowCore(_escrowCore);
    }

    /* ─── Invoice Marketplace ────────────────────────────────────── */

    function listInvoice(uint256 escrowId, uint256 listPrice) external whenNotPaused {
        IDotPay.Escrow memory e = escrowCore.getEscrow(escrowId);
        if (e.status != EscrowStatus.Active) revert EscrowNotActive();

        address nftOwner = nft.ownerOf(e.nftTokenId);
        if (msg.sender != nftOwner) revert Unauthorized();
        if (_escrowListed[escrowId]) revert AlreadyListed();
        if (listPrice == 0 || listPrice >= e.amount) revert InvalidAmount();

        uint256 listingId = nextListingId++;
        listings[listingId] = InvoiceListing({
            escrowId:  escrowId,
            tokenId:   e.nftTokenId,
            seller:    msg.sender,
            listPrice: listPrice,
            faceValue: e.amount,
            active:    true
        });

        _escrowListed[escrowId] = true;
        emit InvoiceListed(escrowId, e.nftTokenId, listPrice);
    }

    function buyInvoice(uint256 listingId) external whenNotPaused nonReentrant {
        InvoiceListing storage listing = listings[listingId];
        if (!listing.active) revert InvoiceNotListed();

        address currentOwner = listing.seller;
        uint256 price = listing.listPrice;

        listing.active = false;
        _escrowListed[listing.escrowId] = false;

        bool pullSuccess = usdc.transferFrom(msg.sender, currentOwner, price);
        if (!pullSuccess) revert TransferFailed();

        nft.transferFrom(currentOwner, msg.sender, listing.tokenId);
        emit InvoiceSold(listing.escrowId, listing.tokenId, msg.sender, price);
    }

    /* ─── Borrowing Against Escrow ───────────────────────────────── */

    function borrowAgainstEscrow(uint256 escrowId, uint256 borrowAmount)
        external whenNotPaused nonReentrant
    {
        IDotPay.Escrow memory e = escrowCore.getEscrow(escrowId);
        if (e.status != EscrowStatus.Active) revert EscrowNotActive();
        if (!e.yieldEnabled) revert InvalidAmount();

        address nftOwner = nft.ownerOf(e.nftTokenId);
        if (msg.sender != nftOwner) revert Unauthorized();

        uint256 currentDebt = escrowCore.debt(escrowId);
        uint256 maxBorrow = (e.amount * LTV_BPS) / 10000;
        if (currentDebt + borrowAmount > maxBorrow) revert BorrowLimitExceeded();

        escrowCore.addDebt(escrowId, borrowAmount);
        escrowCore.transferUSDC(nftOwner, borrowAmount);

        emit BorrowTaken(escrowId, nftOwner, borrowAmount);
    }

    function repayBorrow(uint256 escrowId, uint256 repayAmount)
        external whenNotPaused nonReentrant
    {
        if (repayAmount == 0) revert InvalidAmount();
        uint256 currentDebt = escrowCore.debt(escrowId);
        if (repayAmount > currentDebt) revert InvalidAmount();

        escrowCore.reduceDebt(escrowId, repayAmount);

        bool success = usdc.transferFrom(msg.sender, address(escrowCore), repayAmount);
        if (!success) revert TransferFailed();

        emit BorrowRepaid(escrowId, repayAmount);
    }

    /* ─── View Helpers ───────────────────────────────────────────── */

    function getListing(uint256 id) external view returns (InvoiceListing memory) {
        return listings[id];
    }

    /* ─── Admin Functions ────────────────────────────────────────── */

    function setEscrowCore(address _core) external onlyOwner {
        escrowCore = IEscrowCore(_core);
    }

    function emergencyPause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }
}

/// @notice Minimal interface for EscrowCore calls from InvoiceMarket.
interface IEscrowCore {
    function getEscrow(uint256 id) external view returns (IDotPay.Escrow memory);
    function debt(uint256 escrowId) external view returns (uint256);
    function addDebt(uint256 escrowId, uint256 amount) external;
    function reduceDebt(uint256 escrowId, uint256 amount) external;
    function transferUSDC(address to, uint256 amount) external;
}
