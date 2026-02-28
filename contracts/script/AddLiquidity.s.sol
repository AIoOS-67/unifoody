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

/// @title AddLiquidity — Add FOODY/USDC liquidity to existing V4 pool
contract AddLiquidityScript is Script {
    using CurrencyLibrary for Currency;

    IPositionManager constant POSITION_MANAGER = IPositionManager(0xf969Aee60879C54bAAed9F3eD26147Db216Fd664);

    IERC20 constant USDC = IERC20(0x31d0220469e10c4E71834a79b1f276d740d3768F);

    uint24 constant LP_FEE = 0x800000;
    int24 constant TICK_SPACING = 60;
    int24 constant TARGET_TICK = -345420;

    uint256 constant FOODY_AMOUNT = 20_000e18;
    uint256 constant USDC_AMOUNT = 20e6;

    function run() external {
        IERC20 foodyToken = IERC20(vm.envAddress("FOODY_TOKEN"));
        IHooks hook = IHooks(vm.envAddress("HOOK_ADDRESS"));

        bool foodyIsCurrency0 = address(foodyToken) < address(USDC);
        int24 targetTick = foodyIsCurrency0 ? TARGET_TICK : -TARGET_TICK;

        Currency c0;
        Currency c1;
        if (foodyIsCurrency0) {
            c0 = Currency.wrap(address(foodyToken));
            c1 = Currency.wrap(address(USDC));
        } else {
            c0 = Currency.wrap(address(USDC));
            c1 = Currency.wrap(address(foodyToken));
        }
        PoolKey memory poolKey = PoolKey(c0, c1, LP_FEE, TICK_SPACING, hook);

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

        console2.log("Target tick:", targetTick);
        console2.log("Tick lower:", tickLower);
        console2.log("Tick upper:", tickUpper);
        console2.log("Liquidity:", liquidity);

        bytes memory hookData = new bytes(0);

        bytes memory actions = abi.encodePacked(
            uint8(Actions.MINT_POSITION),
            uint8(Actions.SETTLE_PAIR),
            uint8(Actions.SWEEP),
            uint8(Actions.SWEEP)
        );

        bytes[] memory mintParams = new bytes[](4);
        mintParams[0] = abi.encode(
            poolKey, tickLower, tickUpper, liquidity, amount0 + 1, amount1 + 1, msg.sender, hookData
        );
        mintParams[1] = abi.encode(poolKey.currency0, poolKey.currency1);
        mintParams[2] = abi.encode(poolKey.currency0, msg.sender);
        mintParams[3] = abi.encode(poolKey.currency1, msg.sender);

        vm.startBroadcast();
        POSITION_MANAGER.modifyLiquidities(
            abi.encode(actions, mintParams),
            block.timestamp + 3600
        );
        vm.stopBroadcast();

        console2.log("=== LIQUIDITY ADDED! ===");
    }

    function _truncate(int24 tick, int24 tickSpacing) internal pure returns (int24) {
        return ((tick / tickSpacing) * tickSpacing);
    }
}
