// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Burnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title InvoiceNFT
/// @author DotPay
/// @notice ERC-721 representing tokenized invoice/escrow positions.
///         Each NFT corresponds to an active escrow in InvoiceCore.
///         The current NFT holder is the beneficiary upon escrow release.
contract InvoiceNFT is ERC721, ERC721URIStorage, ERC721Burnable, Ownable {

    /// @notice The InvoiceCore contract address — only address allowed to mint/burn.
    address public minter;

    /// @notice Mapping from tokenId to the corresponding escrowId in InvoiceCore.
    mapping(uint256 => uint256) public escrowIdOf;

    /// @notice Base URI for token metadata hosting.
    string private _baseTokenURI;

    /* ─── Errors ─────────────────────────────────────────────────── */

    error OnlyMinter();
    error ZeroAddress();

    /* ─── Events ─────────────────────────────────────────────────── */

    event MinterUpdated(address indexed oldMinter, address indexed newMinter);
    event BaseURIUpdated(string newBaseURI);

    /* ─── Modifiers ──────────────────────────────────────────────── */

    modifier onlyMinter() {
        if (msg.sender != minter) revert OnlyMinter();
        _;
    }

    /* ─── Constructor ────────────────────────────────────────────── */

    /// @notice Deploy the InvoiceNFT contract.
    /// @param _minter  The InvoiceCore contract address that can mint and burn.
    /// @param _owner   The owner address for administrative functions.
    constructor(
        address _minter,
        address _owner
    ) ERC721("DotPay Invoice", "DPINV") Ownable(_owner) {
        if (_minter == address(0)) revert ZeroAddress();
        minter = _minter;
        emit MinterUpdated(address(0), _minter);
    }

    /* ─── Minter Functions ───────────────────────────────────────── */

    /// @notice Mint a new invoice NFT to the seller/beneficiary.
    /// @param to       The address to receive the NFT (typically the seller).
    /// @param tokenId  The token ID (typically matches the escrowId).
    /// @param uri      The token URI containing escrow metadata.
    /// @param escrowId The corresponding escrow ID in InvoiceCore.
    function mint(
        address to,
        uint256 tokenId,
        string memory uri,
        uint256 escrowId
    ) external onlyMinter {
        escrowIdOf[tokenId] = escrowId;
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, uri);
    }

    /// @notice Burn an invoice NFT (on escrow release or refund).
    /// @dev Only callable by the minter (InvoiceCore), not by the token owner directly.
    /// @param tokenId The token ID to burn.
    function burnByMinter(uint256 tokenId) external onlyMinter {
        _burn(tokenId);
        delete escrowIdOf[tokenId];
    }

    /* ─── Admin Functions ────────────────────────────────────────── */

    /// @notice Update the minter address (e.g., if InvoiceCore is upgraded).
    /// @param _newMinter The new minter address.
    function setMinter(address _newMinter) external onlyOwner {
        if (_newMinter == address(0)) revert ZeroAddress();
        address old = minter;
        minter = _newMinter;
        emit MinterUpdated(old, _newMinter);
    }

    /// @notice Set the base URI for all token metadata.
    /// @param baseURI_ The new base URI string.
    function setBaseURI(string memory baseURI_) external onlyOwner {
        _baseTokenURI = baseURI_;
        emit BaseURIUpdated(baseURI_);
    }

    /* ─── View Functions ─────────────────────────────────────────── */

    /// @notice Get the escrow ID associated with a given token.
    /// @param tokenId The token ID to look up.
    /// @return The escrow ID in InvoiceCore.
    function getEscrowId(uint256 tokenId) external view returns (uint256) {
        return escrowIdOf[tokenId];
    }

    /* ─── Overrides ──────────────────────────────────────────────── */

    function _baseURI() internal view override returns (string memory) {
        return _baseTokenURI;
    }

    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (string memory)
    {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
