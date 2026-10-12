// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {LinkEscrow} from "../src/LinkEscrow.sol";

/// Deploys only the escrow, keeping the existing test dollars and balances.
///   GATEKEEPER=0x... forge script script/DeployEscrow.s.sol --rpc-url monad_testnet --account deployer --broadcast
contract DeployEscrow is Script {
    function run() external {
        address gatekeeper = vm.envAddress("GATEKEEPER");
        vm.startBroadcast();
        LinkEscrow escrow = new LinkEscrow(gatekeeper);
        vm.stopBroadcast();

        console.log("LinkEscrow:", address(escrow));
        console.log("Gatekeeper:", gatekeeper);
    }
}
