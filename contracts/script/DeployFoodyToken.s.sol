// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {FoodyToken} from "../src/FoodyToken.sol";

/// @title DeployFoodyToken — Deploy FoodyeCoin (FOODY) ERC-20 on Unichain
/// @notice Deploys the FOODY token with initial supply for liquidity provisioning.
///
/// @dev Usage:
///   forge script script/DeployFoodyToken.s.sol \
///     --rpc-url unichain_sepolia \
///     --private-key $PRIVATE_KEY \
///     --broadcast \
///     --verify
contract DeployFoodyTokenScript is Script {
    /// @dev Initial supply: 10M FOODY for liquidity + rewards
    uint256 constant INITIAL_SUPPLY = 10_000_000 * 1e18;

    function run() external {
        address admin = vm.envAddress("ADMIN_ADDRESS");

        console2.log("=== FoodyToken Deployment on Unichain ===");
        console2.log("Admin:", admin);
        console2.log("Initial Supply:", INITIAL_SUPPLY / 1e18, "FOODY");
        console2.log("Max Supply: 1,000,000,000 FOODY");

        vm.startBroadcast();

        FoodyToken token = new FoodyToken(admin, INITIAL_SUPPLY);

        vm.stopBroadcast();

        console2.log("");
        console2.log("=== Deployment Successful ===");
        console2.log("FoodyToken:", address(token));
        console2.log("Name:", token.name());
        console2.log("Symbol:", token.symbol());
        console2.log("Total Supply:", token.totalSupply() / 1e18, "FOODY");
        console2.log("");
        console2.log("Next steps:");
        console2.log("1. Set FOODY_TOKEN in .env to:", address(token));
        console2.log("2. Deploy FoodySwapHook");
        console2.log("3. Grant MINTER_ROLE to the Hook contract");
    }
}
