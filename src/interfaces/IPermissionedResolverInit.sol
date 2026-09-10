// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

/// @notice The deployed `PermissionedResolver`'s initializer, for deploying one behind a
///         `VerifiableFactory` proxy.
/// @dev The same problem `IUserRegistryInit` exists for. The submodule pins
///      `initialize(address,uint256,bytes[])`; the contract deployed on Sepolia takes an array of
///      role assignments instead, `initialize((address,uint256)[],bytes[])`, selector `0x33cc44a0`
///      — confirmed against the deployed bytecode. Importing `PermissionedResolver` from `lib/`
///      would encode init data the real proxy rejects.
interface IPermissionedResolverInit {
    /// @param account The address receiving `roleBitmap` on ROOT_RESOURCE.
    /// @param roleBitmap Roles from `PermissionedResolverLib`, not `RegistryRolesLib`.
    struct RoleAssignment {
        address account;
        uint256 roleBitmap;
    }

    /// @param assignments Root role holders, set atomically with deployment.
    /// @param data Purpose not established. The submodule's older signature takes a `bytes[]` of
    ///        calls to run at init; whether the deployed one still does is unconfirmed, so pass an
    ///        empty array unless something needs it.
    function initialize(RoleAssignment[] calldata assignments, bytes[] calldata data) external;
}
