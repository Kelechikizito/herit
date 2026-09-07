// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

/// @notice The subset of `PermissionedResolver`'s writes that Herit performs.
/// @dev Declared locally because `IPermissionedResolver` inherits only `IExtendedResolver` and
///      `IEnhancedAccessControl`, so it exposes the reads and the roles but none of the setters.
interface IHeritResolver {
    /// @param node Namehash of the full name, not the labelhash the registry uses.
    /// @param coinType SLIP-44 coin type; 60 is ETH.
    /// @param addressBytes The encoded address. Must be 0 or 20 bytes for EVM coin types.
    function setAddr(bytes32 node, uint256 coinType, bytes calldata addressBytes) external;

    /// @param node Namehash of the full name, not the labelhash the registry uses.
    function setText(bytes32 node, string calldata key, string calldata value) external;
}
