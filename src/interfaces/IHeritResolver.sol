// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

/// @notice The subset of the deployed `PermissionedResolver` that Herit calls.
/// @dev Declared locally for two reasons. `IPermissionedResolver` inherits only
///      `IExtendedResolver` and `IEnhancedAccessControl`, so it carries the roles but none of the
///      setters. And the copy of `PermissionedResolver` in `lib/` is older than the contract
///      deployed on Sepolia: the pinned version addresses records by namehash
///      (`setAddr(bytes32,...)`), the deployed one by DNS-encoded name. Importing the submodule's
///      interface would compile against functions that do not exist on chain.
///
///      Two argument forms appear below and they are not interchangeable — mixing them up is what
///      made this interface wrong in the first place:
///        - `name` is DNS-encoded: `\x03son\x05alice\x05herit\x03eth\x00`. Every setter wants this.
///        - `node` is the namehash of the same name, and appears only inside `resolve`'s inner
///          calldata.
interface IHeritResolver {
    /// @notice Writes the address a name points at.
    /// @param name The heir's full name, DNS-encoded. NOT a namehash.
    /// @param coinType SLIP-44 coin type; 60 is ETH.
    /// @param addressBytes The encoded address. Must be 0 or 20 bytes for EVM coin types.
    function setAddress(bytes calldata name, uint256 coinType, bytes calldata addressBytes) external;

    /// @notice Writes one text record, such as `herit.relationship` or `herit.share`.
    /// @param name The heir's full name, DNS-encoded. NOT a namehash.
    function setText(bytes calldata name, string calldata key, string calldata value) external;

    /// @notice The only read the deployed resolver exposes; there is no `text(bytes32,string)`.
    /// @param name The heir's full name, DNS-encoded.
    /// @param data The read to perform, ABI-encoded, e.g.
    ///        `abi.encodeWithSelector(ITextResolver.text.selector, node, "herit.share")`. Note the
    ///        namehash goes here, inside `data`, while `name` above is DNS-encoded.
    /// @return The ABI-encoded result, to be decoded to the inner call's return type.
    function resolve(bytes calldata name, bytes calldata data) external view returns (bytes memory);
}
