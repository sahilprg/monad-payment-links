// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {LinkEscrow} from "../src/LinkEscrow.sol";
import {MockUSD} from "../src/MockUSD.sol";

/// Deploys the escrow and a test stablecoin.
///   GATEKEEPER=0x... forge script script/Deploy.s.sol --rpc-url monad_testnet --account deployer --broadcast
contract Deploy is Script {
    function run() external {
        address gatekeeper = vm.envAddress("GATEKEEPER");
        vm.startBroadcast();
        LinkEscrow escrow = new LinkEscrow(gatekeeper);
        MockUSD usd = new MockUSD();
        vm.stopBroadcast();

        console.log("LinkEscrow:", address(escrow));
        console.log("MockUSD:   ", address(usd));
    }
}
