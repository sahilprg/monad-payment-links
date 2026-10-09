// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {LinkEscrow} from "../src/LinkEscrow.sol";
import {MockUSD} from "../src/MockUSD.sol";

contract LinkEscrowTest is Test {
    LinkEscrow escrow;
    MockUSD usd;

    address sender = makeAddr("sender");
    address recipient = makeAddr("recipient");
    address relayer = makeAddr("relayer");
    address attacker = makeAddr("attacker");

    uint256 linkPk;
    address claimKey;

    uint256 constant AMOUNT = 50e6; // 50.00 mUSD
    uint64 expiry;

    function setUp() public {
        escrow = new LinkEscrow();
        usd = new MockUSD();
        (claimKey, linkPk) = makeAddrAndKey("link");
        expiry = uint64(block.timestamp + 7 days);

        usd.mint(sender, 1_000e6);
        vm.prank(sender);
        usd.approve(address(escrow), type(uint256).max);
    }

    function _deposit() internal {
        vm.prank(sender);
        escrow.deposit(address(usd), AMOUNT, claimKey, expiry);
    }

    function _sign(uint256 pk, address to) internal view returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, escrow.claimDigest(claimKey, to));
        return abi.encodePacked(r, s, v);
    }

    // ---- deposit ----

    function test_Deposit_LocksTokens() public {
        _deposit();
        (address s, address token, uint256 amount, uint64 exp, bool settled) = escrow.transfers(claimKey);
        assertEq(s, sender);
        assertEq(token, address(usd));
        assertEq(amount, AMOUNT);
        assertEq(exp, expiry);
        assertFalse(settled);
        assertEq(usd.balanceOf(address(escrow)), AMOUNT);
    }

    function test_Deposit_RevertsOnZeroAmount() public {
        vm.prank(sender);
        vm.expectRevert(LinkEscrow.ZeroAmount.selector);
        escrow.deposit(address(usd), 0, claimKey, expiry);
    }

    function test_Deposit_RevertsOnZeroClaimKey() public {
        vm.prank(sender);
        vm.expectRevert(LinkEscrow.ZeroAddress.selector);
        escrow.deposit(address(usd), AMOUNT, address(0), expiry);
    }

    function test_Deposit_RevertsOnPastExpiry() public {
        vm.prank(sender);
        vm.expectRevert(LinkEscrow.ExpiryInPast.selector);
        escrow.deposit(address(usd), AMOUNT, claimKey, uint64(block.timestamp));
    }

    function test_Deposit_RevertsOnReusedKey() public {
        _deposit();
        vm.prank(sender);
        vm.expectRevert(LinkEscrow.KeyAlreadyUsed.selector);
        escrow.deposit(address(usd), AMOUNT, claimKey, expiry);
    }

    // ---- claim ----

    function test_Claim_ViaRelayer_PaysRecipient() public {
        _deposit();
        bytes memory sig = _sign(linkPk, recipient);

        vm.prank(relayer);
        escrow.claim(claimKey, recipient, sig);

        assertEq(usd.balanceOf(recipient), AMOUNT);
        assertEq(usd.balanceOf(relayer), 0);
        assertEq(usd.balanceOf(address(escrow)), 0);
    }

    /// An attacker who sees the claim in flight cannot redirect it to themselves.
    function test_Claim_RevertsWhenRecipientSwapped() public {
        _deposit();
        bytes memory sig = _sign(linkPk, recipient);

        vm.prank(attacker);
        vm.expectRevert(LinkEscrow.BadSignature.selector);
        escrow.claim(claimKey, attacker, sig);
    }

    function test_Claim_RevertsOnWrongSigner() public {
        _deposit();
        (, uint256 otherPk) = makeAddrAndKey("other");
        bytes memory sig = _sign(otherPk, attacker);

        vm.expectRevert(LinkEscrow.BadSignature.selector);
        escrow.claim(claimKey, attacker, sig);
    }

    function test_Claim_RevertsOnGarbageSignature() public {
        _deposit();
        vm.expectRevert(LinkEscrow.BadSignature.selector);
        escrow.claim(claimKey, recipient, hex"1234");
    }

    function test_Claim_RevertsOnDoubleClaim() public {
        _deposit();
        bytes memory sig = _sign(linkPk, recipient);
        escrow.claim(claimKey, recipient, sig);

        vm.expectRevert(LinkEscrow.AlreadySettled.selector);
        escrow.claim(claimKey, recipient, sig);
    }

    function test_Claim_RevertsAfterExpiry() public {
        _deposit();
        bytes memory sig = _sign(linkPk, recipient);
        vm.warp(uint256(expiry) + 1);

        vm.expectRevert(LinkEscrow.Expired.selector);
        escrow.claim(claimKey, recipient, sig);
    }

    function test_Claim_RevertsOnUnknownKey() public {
        bytes memory sig = _sign(linkPk, recipient);
        vm.expectRevert(LinkEscrow.NoSuchTransfer.selector);
        escrow.claim(claimKey, recipient, sig);
    }

    /// A signature made for one deployment of the escrow does not work on another.
    function test_Claim_SignatureNotReusableOnAnotherEscrow() public {
        LinkEscrow other = new LinkEscrow();
        vm.startPrank(sender);
        usd.approve(address(other), type(uint256).max);
        other.deposit(address(usd), AMOUNT, claimKey, expiry);
        vm.stopPrank();

        bytes memory sigForFirst = _sign(linkPk, recipient);
        vm.expectRevert(LinkEscrow.BadSignature.selector);
        other.claim(claimKey, recipient, sigForFirst);
    }

    // ---- refund ----

    function test_Refund_RevertsBeforeExpiry() public {
        _deposit();
        vm.prank(sender);
        vm.expectRevert(LinkEscrow.NotExpiredYet.selector);
        escrow.refund(claimKey);
    }

    function test_Refund_AfterExpiry_ReturnsToSender_EvenIfCalledByOthers() public {
        _deposit();
        uint256 before = usd.balanceOf(sender);
        vm.warp(uint256(expiry) + 1);

        vm.prank(attacker);
        escrow.refund(claimKey);

        assertEq(usd.balanceOf(sender), before + AMOUNT);
        assertEq(usd.balanceOf(attacker), 0);
    }

    function test_Refund_RevertsAfterClaim() public {
        _deposit();
        escrow.claim(claimKey, recipient, _sign(linkPk, recipient));
        vm.warp(uint256(expiry) + 1);

        vm.expectRevert(LinkEscrow.AlreadySettled.selector);
        escrow.refund(claimKey);
    }

    function test_Refund_RevertsOnDoubleRefund() public {
        _deposit();
        vm.warp(uint256(expiry) + 1);
        escrow.refund(claimKey);

        vm.expectRevert(LinkEscrow.AlreadySettled.selector);
        escrow.refund(claimKey);
    }

    // ---- fuzz ----

    function testFuzz_ClaimPaysExactlyDeposit(uint256 amount, address to) public {
        amount = bound(amount, 1, 1_000e6);
        vm.assume(to != address(0) && to != address(escrow));
        uint256 toBefore = usd.balanceOf(to);

        vm.prank(sender);
        escrow.deposit(address(usd), amount, claimKey, expiry);
        escrow.claim(claimKey, to, _sign(linkPk, to));

        assertEq(usd.balanceOf(to), toBefore + amount);
        assertEq(usd.balanceOf(address(escrow)), 0);
    }
}
