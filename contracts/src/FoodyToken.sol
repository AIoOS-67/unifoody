// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

/// @title FoodyToken — ERC-20 Loyalty & Payment Token for UniFoody on Unichain
/// @author UniFoody Team
/// @notice FoodyeCoin (FOODY) is the native token for the UniFoody restaurant payment
///         and loyalty rewards ecosystem on Unichain. It is used for:
///         - Restaurant payments via Uniswap V4 FOODY/USDC swaps
///         - Cashback rewards minted by the FoodySwapHook after each swap
///         - Loyalty tier progression (Bronze → Silver → Gold → VIP)
///         - Community governance and incentives
///
/// @dev Access control:
///      - DEFAULT_ADMIN_ROLE: Can grant/revoke roles, pause in emergencies
///      - MINTER_ROLE: Only the FoodySwapHook contract should hold this role
///        so cashback tokens are minted trustlessly on each qualifying swap
contract FoodyToken is ERC20, AccessControl {
    /// @notice Role identifier for addresses allowed to mint new FOODY tokens
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    /// @notice Maximum total supply cap: 1 billion FOODY
    uint256 public constant MAX_SUPPLY = 1_000_000_000 * 1e18;

    /// @notice Emitted when tokens are minted as cashback rewards
    event CashbackMinted(address indexed to, uint256 amount, address indexed minter);

    /// @param admin The address that receives DEFAULT_ADMIN_ROLE (can grant MINTER_ROLE)
    /// @param initialSupply Initial tokens to mint to the admin (for liquidity pools, etc.)
    constructor(
        address admin,
        uint256 initialSupply
    ) ERC20("FoodyeCoin", "FOODY") {
        require(admin != address(0), "FoodyToken: zero admin");
        require(initialSupply <= MAX_SUPPLY, "FoodyToken: exceeds max supply");

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MINTER_ROLE, admin); // Admin can mint initially; transfer to Hook later

        if (initialSupply > 0) {
            _mint(admin, initialSupply);
        }
    }

    /// @notice Mint new FOODY tokens. Only callable by MINTER_ROLE holders.
    /// @dev The FoodySwapHook calls this in afterSwap() to distribute cashback rewards.
    /// @param to Recipient of the minted tokens
    /// @param amount Amount of FOODY to mint (18 decimals)
    function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) {
        require(totalSupply() + amount <= MAX_SUPPLY, "FoodyToken: cap exceeded");
        _mint(to, amount);
        emit CashbackMinted(to, amount, msg.sender);
    }

    /// @notice Burn tokens from the caller's balance
    /// @param amount Amount of FOODY to burn
    function burn(uint256 amount) external {
        _burn(msg.sender, amount);
    }

    /// @notice Check remaining mintable supply
    /// @return The number of tokens that can still be minted before hitting MAX_SUPPLY
    function remainingMintableSupply() external view returns (uint256) {
        return MAX_SUPPLY - totalSupply();
    }
}
