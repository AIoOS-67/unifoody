// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {IERC20} from "forge-std/interfaces/IERC20.sol";

import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {IPositionManager} from "@uniswap/v4-periphery/src/interfaces/IPositionManager.sol";
import {IPermit2} from "permit2/src/interfaces/IPermit2.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {CurrencyLibrary, Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {LiquidityAmounts} from "@uniswap/v4-core/test/utils/LiquidityAmounts.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";
import {Actions} from "@uniswap/v4-periphery/src/libraries/Actions.sol";

/// @title CreatePool — Create FOODY/USDC V4 Pool + Add Liquidity on Unichain
/// @notice Standalone script for creating the FoodySwap pool on Unichain.
///
/// @dev Usage:
///   forge script script/CreatePool.s.sol \
///     --rpc-url unichain_sepolia \
///     --private-key $PRIVATE_KEY \
///     --broadcast
contract CreatePoolScript is Script {
    using CurrencyLibrary for Currency;

    // =========================================================================
    // Unichain Infrastructure (canonical V4 addresses)
    // =========================================================================
    IPoolManager constant POOL_MANAGER = IPoolManager(0x00B036B58a818B1BC34d502D3fE730Db729e62AC);
    IPositionManager constant POSITION_MANAGER = IPositionManager(0xf969Aee60879C54bAAed9F3eD26147Db216Fd664);
    IPermit2 constant PERMIT2 = IPermit2(0x000000000022D473030F116dDEE9F6B43aC78BA3);

    // USDC on Unichain Sepolia (official Circle testnet USDC)
    IERC20 constant USDC = IERC20(0x31d0220469e10c4E71834a79b1f276d740d3768F);

    // Pool Configuration
    uint24 constant LP_FEE = 0x800000; // DYNAMIC_FEE_FLAG
    int24 constant TICK_SPACING = 60;
    int24 constant TARGET_TICK = -368460; // 1 FOODY ~ $0.0001 USDC

    // Liquidity amounts (testnet: 20 USDC + 200K FOODY at 1 FOODY = $0.0001)
    uint256 constant FOODY_AMOUNT = 200_000e18;
    uint256 constant USDC_AMOUNT = 20e6;

    function run() external {
        IERC20 foodyToken = IERC20(vm.envAddress("FOODY_TOKEN"));
        IHooks hook = IHooks(vm.envAddress("HOOK_ADDRESS"));

        // Determine token ordering
        bool foodyIsCurrency0 = address(foodyToken) < address(USDC);

        PoolKey memory poolKey = _buildPoolKey(foodyToken, hook, foodyIsCurrency0);
        int24 targetTick = foodyIsCurrency0 ? TARGET_TICK : -TARGET_TICK;

        _logSetup(foodyToken, hook, foodyIsCurrency0, targetTick);

        // Build multicall params
        bytes[] memory multicallParams = _buildMulticallParams(poolKey, targetTick, foodyIsCurrency0);

        // Execute
        vm.startBroadcast();
        _approveTokens(foodyToken);
        POSITION_MANAGER.multicall(multicallParams);
        vm.stopBroadcast();

        console2.log("");
        console2.log("=== POOL CREATED ON UNICHAIN! ===");
        console2.log("FOODY provided: 100,000 tokens");
        console2.log("USDC provided: 100 tokens");
    }

    function _buildPoolKey(IERC20 foodyToken, IHooks hook, bool foodyIsCurrency0)
        internal pure returns (PoolKey memory)
    {
        Currency c0;
        Currency c1;
        if (foodyIsCurrency0) {
            c0 = Currency.wrap(address(foodyToken));
            c1 = Currency.wrap(address(USDC));
        } else {
            c0 = Currency.wrap(address(USDC));
            c1 = Currency.wrap(address(foodyToken));
        }
        return PoolKey(c0, c1, LP_FEE, TICK_SPACING, hook);
    }

    function _buildMulticallParams(
        PoolKey memory poolKey,
        int24 targetTick,
        bool foodyIsCurrency0
    ) internal view returns (bytes[] memory) {
        uint160 startingPrice = TickMath.getSqrtPriceAtTick(targetTick);
        int24 tickLower = _truncate(targetTick - 750 * TICK_SPACING, TICK_SPACING);
        int24 tickUpper = _truncate(targetTick + 750 * TICK_SPACING, TICK_SPACING);

        uint256 amount0 = foodyIsCurrency0 ? FOODY_AMOUNT : USDC_AMOUNT;
        uint256 amount1 = foodyIsCurrency0 ? USDC_AMOUNT : FOODY_AMOUNT;

        uint128 liquidity = LiquidityAmounts.getLiquidityForAmounts(
            startingPrice,
            TickMath.getSqrtPriceAtTick(tickLower),
            TickMath.getSqrtPriceAtTick(tickUpper),
            amount0,
            amount1
        );

        bytes memory hookData = new bytes(0);
        (bytes memory actions, bytes[] memory mintParams) = _mintLiquidityParams(
            poolKey, tickLower, tickUpper, liquidity, amount0 + 1, amount1 + 1, msg.sender, hookData
        );

        bytes[] memory params = new bytes[](2);
        params[0] = abi.encodeWithSelector(
            POSITION_MANAGER.initializePool.selector, poolKey, startingPrice, hookData
        );
        params[1] = abi.encodeWithSelector(
            POSITION_MANAGER.modifyLiquidities.selector,
            abi.encode(actions, mintParams),
            block.timestamp + 3600
        );
        return params;
    }

    function _approveTokens(IERC20 foodyToken) internal {
        foodyToken.approve(address(PERMIT2), type(uint256).max);
        PERMIT2.approve(address(foodyToken), address(POSITION_MANAGER), type(uint160).max, type(uint48).max);
        USDC.approve(address(PERMIT2), type(uint256).max);
        PERMIT2.approve(address(USDC), address(POSITION_MANAGER), type(uint160).max, type(uint48).max);
    }

    function _logSetup(IERC20 foodyToken, IHooks hook, bool foodyIsCurrency0, int24 targetTick) internal view {
        console2.log("=== Create FOODY/USDC Pool on Unichain ===");
        console2.log("FOODY:", address(foodyToken));
        console2.log("USDC:", address(USDC));
        console2.log("Hook:", address(hook));
        console2.log("FOODY is currency0:", foodyIsCurrency0);
        console2.log("Target tick:", targetTick);
        console2.log("Deployer FOODY:", foodyToken.balanceOf(msg.sender) / 1e18);
        console2.log("Deployer USDC:", USDC.balanceOf(msg.sender) / 1e6);
    }

    function _mintLiquidityParams(
        PoolKey memory poolKey,
        int24 _tickLower,
        int24 _tickUpper,
        uint256 liquidity,
        uint256 amount0Max,
        uint256 amount1Max,
        address recipient,
        bytes memory hookData
    ) internal pure returns (bytes memory, bytes[] memory) {
        bytes memory actions = abi.encodePacked(
            uint8(Actions.MINT_POSITION),
            uint8(Actions.SETTLE_PAIR),
            uint8(Actions.SWEEP),
            uint8(Actions.SWEEP)
        );

        bytes[] memory mintParams = new bytes[](4);
        mintParams[0] = abi.encode(
            poolKey, _tickLower, _tickUpper, liquidity, amount0Max, amount1Max, recipient, hookData
        );
        mintParams[1] = abi.encode(poolKey.currency0, poolKey.currency1);
        mintParams[2] = abi.encode(poolKey.currency0, recipient);
        mintParams[3] = abi.encode(poolKey.currency1, recipient);

        return (actions, mintParams);
    }

    function _truncate(int24 tick, int24 tickSpacing) internal pure returns (int24) {
        return ((tick / tickSpacing) * tickSpacing);
    }
}
