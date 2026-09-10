// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

/// @notice `UserRegistry`'s initializer, as the *deployed* hackathon implementation declares it.
/// @dev The pinned submodule declares `initialize(address,uint256)` (`0xcd6dc687`). The deployed
///      `UserRegistryImpl` at `0x47B4…2546` declares `initialize((address,uint256)[])`
///      (`0x37cb53a8`), taking an array so several accounts can hold root roles from birth.
///      Confirmed by selector scan of the deployed runtime; see `documents/deployments.md`.
///
///      Importing `UserRegistry` from the submodule to encode this call would type-check against
///      the wrong signature and hand the proxy init data it rejects, so the interface is declared
///      locally instead. `AccessControlGate` encodes the same call by raw selector; this file is
///      the type-safe form of that constant, and the gate can move onto it whenever convenient.
interface IUserRegistryInit {
    /// @param account Account granted `roleBitmap` on the new registry's `ROOT_RESOURCE`.
    /// @param roleBitmap Roles to grant, in the nybble-packed `EnhancedAccessControl` layout.
    struct RoleAssignment {
        address account;
        uint256 roleBitmap;
    }

    /// @param assignments One entry per account that should hold root roles at birth.
    function initialize(RoleAssignment[] calldata assignments) external;
}
