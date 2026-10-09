// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {LinkEscrow} from "../src/LinkEscrow.sol";
import {MockUSD} from "../src/MockUSD.sol";

/// Deploys the escrow and a test stablecoin.
///   forge script script/Deploy.s.sol --rpc-url monad_testnet --account deployer --broadcast
contract Deploy is Script {
    function run() external {
        vm.startBroadcast();
        LinkEscrow escrow = new LinkEscrow();
        MockUSD usd = new MockUSD();
        vm.stopBroadcast();

        console.log("LinkEscrow:", address(escrow));
        console.log("MockUSD:   ", address(usd));
    }
}
