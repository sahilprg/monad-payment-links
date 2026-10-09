// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title LinkEscrow
/// @notice Holds tokens for "payment links". The sender locks tokens against a
///         one-time key. Whoever holds that key (it travels inside the link)
///         signs the address that should receive the money, and anyone can
///         then submit the claim, so the recipient never needs gas.
contract LinkEscrow is ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct Transfer {
        address sender;
        address token;
        uint256 amount;
        uint64 expiry;
        bool settled;
    }

    /// @notice One transfer per one-time key, looked up by the key's address.
    mapping(address claimKey => Transfer) public transfers;

    event Deposited(
        address indexed claimKey, address indexed sender, address indexed token, uint256 amount, uint64 expiry
    );
    event Claimed(address indexed claimKey, address indexed recipient, uint256 amount);
    event Refunded(address indexed claimKey, address indexed sender, uint256 amount);

    error ZeroAmount();
    error ZeroAddress();
    error ExpiryInPast();
    error KeyAlreadyUsed();
    error NoSuchTransfer();
    error AlreadySettled();
    error Expired();
    error NotExpiredYet();
    error BadSignature();

    /// @notice Lock `amount` of `token` against the one-time key `claimKey`.
    /// @dev The sender must approve this contract for `amount` first.
    /// @param claimKey Address of the one-time key whose private key is in the link.
    /// @param expiry Unix time after which the sender can take the money back.
    function deposit(address token, uint256 amount, address claimKey, uint64 expiry) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        if (token == address(0) || claimKey == address(0)) revert ZeroAddress();
        if (expiry <= block.timestamp) revert ExpiryInPast();
        if (transfers[claimKey].sender != address(0)) revert KeyAlreadyUsed();

        // Record what actually arrived, in case the token takes a fee on transfer.
        uint256 balanceBefore = IERC20(token).balanceOf(address(this));
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        uint256 received = IERC20(token).balanceOf(address(this)) - balanceBefore;
        if (received == 0) revert ZeroAmount();

        transfers[claimKey] =
            Transfer({sender: msg.sender, token: token, amount: received, expiry: expiry, settled: false});

        emit Deposited(claimKey, msg.sender, token, received, expiry);
    }

    /// @notice Pay out a transfer to `recipient`. Anyone may call this (for
    ///         example a relayer paying the gas); the money can only go to the
    ///         address the one-time key signed.
    /// @param signature Signature by the one-time key over `claimDigest(claimKey, recipient)`.
    function claim(address claimKey, address recipient, bytes calldata signature) external nonReentrant {
        Transfer storage t = transfers[claimKey];
        if (t.sender == address(0)) revert NoSuchTransfer();
        if (t.settled) revert AlreadySettled();
        if (block.timestamp > t.expiry) revert Expired();
        if (recipient == address(0)) revert ZeroAddress();

        (address signer,,) = ECDSA.tryRecover(claimDigest(claimKey, recipient), signature);
        if (signer != claimKey) revert BadSignature();

        t.settled = true;
        IERC20(t.token).safeTransfer(recipient, t.amount);

        emit Claimed(claimKey, recipient, t.amount);
    }

    /// @notice Return an unclaimed transfer to its sender after it expires.
    ///         Anyone may call this; the money only ever goes back to the sender.
    function refund(address claimKey) external nonReentrant {
        Transfer storage t = transfers[claimKey];
        if (t.sender == address(0)) revert NoSuchTransfer();
        if (t.settled) revert AlreadySettled();
        if (block.timestamp <= t.expiry) revert NotExpiredYet();

        t.settled = true;
        IERC20(t.token).safeTransfer(t.sender, t.amount);

        emit Refunded(claimKey, t.sender, t.amount);
    }

    /// @notice The hash the one-time key must sign (as an Ethereum signed message)
    ///         to send its transfer to `recipient`. Bound to this chain and this
    ///         contract so a signature cannot be reused elsewhere.
    function claimDigest(address claimKey, address recipient) public view returns (bytes32) {
        return MessageHashUtils.toEthSignedMessageHash(rawClaimHash(claimKey, recipient));
    }

    /// @notice The 32 bytes a wallet library signs with `signMessage({ raw })`.
    function rawClaimHash(address claimKey, address recipient) public view returns (bytes32) {
        return keccak256(abi.encode(block.chainid, address(this), claimKey, recipient));
    }
}
