// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {IHeritResolver} from "src/interfaces/IHeritResolver.sol";

/// @title MockHeritResolver
/// @notice Accepts the record writes `AccessControlGate._writeHeirRecords` makes, and remembers
///         them so a test can read them back.
/// @dev Exists because the *deployed* `PermissionedResolverImpl` on Sepolia
///      (`0xa9d3…614e`) does not expose the functions the gate calls. A selector scan of its
///      runtime shows it is name-based — `setAddress(bytes,uint256,bytes)` (`0xb4436dde`) and
///      `setText(bytes,string,string)` (`0xc7279f88`), taking a DNS-encoded name — while the gate
///      calls the node-based `setAddr(bytes32,uint256,bytes)` (`0x8b95dd71`) and
///      `setText(bytes32,string,string)` (`0x10f13a8c`), which are absent. Against the real
///      resolver, `registerHeir` reverts.
///
///      So this mock is a scaffold with a deliberate expiry date. It lets the registry half of the
///      happy path — which is the entire ENS-track proof — be tested today, while the resolver half
///      is still wrong. It asserts nothing about whether the gate's resolver calls are *correct*;
///      it only asserts they are consistent with `IHeritResolver`, which is currently the wrong
///      interface.
///
///      Delete this file once `_writeHeirRecords` is rewritten for DNS-encoded names, and point
///      the test at a real `PermissionedResolver` proxy instead. A passing test against this mock
///      is not evidence that records land on Sepolia.
contract MockHeritResolver is IHeritResolver {
    /// @dev node => coinType => encoded address, as written.
    mapping(bytes32 => mapping(uint256 => bytes)) public addrs;

    /// @dev node => key => value, as written.
    mapping(bytes32 => mapping(string => string)) public texts;

    /// @dev Counts writes so a test can assert the gate wrote at all, not merely wrote nothing.
    uint256 public writeCount;

    function setAddr(bytes32 node, uint256 coinType, bytes calldata addressBytes) external {
        addrs[node][coinType] = addressBytes;
        writeCount++;
    }

    function setText(bytes32 node, string calldata key, string calldata value) external {
        texts[node][key] = value;
        writeCount++;
    }
}
