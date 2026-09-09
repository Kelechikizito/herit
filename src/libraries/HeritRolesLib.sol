// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {RegistryRolesLib} from "@ensdomains/contracts-v2/registry/libraries/RegistryRolesLib.sol";
import {PermissionedResolverLib} from "@ensdomains/contracts-v2/resolver/libraries/PermissionedResolverLib.sol";

/// @dev Herit's roles within the `EnhancedAccessControl` nybble-packed bitmap, alongside the
///      registry roles in `RegistryRolesLib`. That library occupies nybbles 0-9 and 30-31; Herit
///      uses 10-11. Stay inside 10-29: colliding with a registry nybble would make a Herit
///      permission and an ENS one the same bit.
library HeritRolesLib {
    /// @dev Nybble 10: authorizes an heir to claim their share. Token only.
    ///      Withheld at registration and granted on unlock, so this bit is the inheritance.
    uint256 internal constant ROLE_HEIR_CLAIM = 1 << 40;
    /// @dev Nybble 42: authorizes setting `ROLE_HEIR_CLAIM`.
    uint256 internal constant ROLE_HEIR_CLAIM_ADMIN = ROLE_HEIR_CLAIM << 128;

    /// @dev Nybble 11: marks a subname as an heir slot created by Herit. Token only.
    uint256 internal constant ROLE_HEIR_REGISTERED = 1 << 44;
    /// @dev Nybble 43: authorizes setting `ROLE_HEIR_REGISTERED`.
    uint256 internal constant ROLE_HEIR_REGISTERED_ADMIN = ROLE_HEIR_REGISTERED << 128;

    /// @dev Roles the grantor receives on their own name in registry A. Withholds
    ///      `ROLE_SET_SUBREGISTRY` so the estate registry can never be swapped for one the grantor
    ///      controls, `ROLE_UNREGISTER` so the name cannot be deleted out from under the heirs, and
    ///      `ROLE_CAN_TRANSFER_ADMIN` so the estate cannot be sold. What is left lets the grantor
    ///      point their own name at a resolver and keep it renewed.
    uint256 internal constant GRANTOR_NAME_ROLE_BITMAP =
        RegistryRolesLib.ROLE_SET_RESOLVER | RegistryRolesLib.ROLE_SET_RESOLVER_ADMIN | RegistryRolesLib.ROLE_RENEW;

    /// @dev Roles an heir receives at registration. Withholds `ROLE_CAN_TRANSFER_ADMIN` so the
    ///      slot cannot be sold, and `ROLE_HEIR_CLAIM` so unlock has something to grant.
    uint256 internal constant HEIR_REGISTRATION_ROLE_BITMAP = RegistryRolesLib.ROLE_SET_RESOLVER
        | RegistryRolesLib.ROLE_SET_RESOLVER_ADMIN | RegistryRolesLib.ROLE_SET_SUBREGISTRY
        | RegistryRolesLib.ROLE_SET_SUBREGISTRY_ADMIN | ROLE_HEIR_REGISTERED;

    /// @dev Roles `AccessControlGate` holds on the ROOT_RESOURCE of the `PermissionedResolver`,
    ///      letting it write every heir's `addr`, `herit.relationship` and `herit.share` record.
    ///      Root grants fall through to every resource, so one resolver serves every estate.
    ///
    ///      These come from `PermissionedResolverLib`, NOT `RegistryRolesLib`. The two libraries
    ///      number their roles independently and their bits overlap, so `GATE_ROOT_ROLE_BITMAP`
    ///      means something entirely different here and must never be substituted.
    ///
    ///      Each regular role is paired with its admin half for the same reason
    ///      `GATE_ROOT_ROLE_BITMAP` is: `EnhancedAccessControl._getSettableRoles` lets an account
    ///      grant only the roles whose admin halves it holds. The deployer initializes the
    ///      resolver holding this bitmap and then grants the same bitmap to the gate, and without
    ///      the admin halves that second step reverts `EACCannotGrantRoles`. The gate never calls
    ///      `grantRoles` on the resolver, so the admin bits sit unused on its side.
    uint256 internal constant GATE_RESOLVER_ROLE_BITMAP = PermissionedResolverLib.ROLE_SET_ADDR
        | PermissionedResolverLib.ROLE_SET_ADDR_ADMIN | PermissionedResolverLib.ROLE_SET_TEXT
        | PermissionedResolverLib.ROLE_SET_TEXT_ADMIN;

    /// @dev Roles `AccessControlGate` holds on the root resource of each registry it controls,
    ///      passed as `UserRegistry.initialize`'s `roleBitmap`. Settable roles on a name are the
    ///      root admin bits shifted down 128, so `ROLE_HEIR_CLAIM_ADMIN` here is what permits
    ///      `grantRoles(heirLabel, ROLE_HEIR_CLAIM, heir)`. `ROLE_RENEW` keeps heir subnames from
    ///      expiring, since a role cannot be granted on an expired name.
    uint256 internal constant GATE_ROOT_ROLE_BITMAP = RegistryRolesLib.ROLE_REGISTRAR
        | RegistryRolesLib.ROLE_REGISTRAR_ADMIN | RegistryRolesLib.ROLE_RENEW | RegistryRolesLib.ROLE_RENEW_ADMIN
        | RegistryRolesLib.ROLE_SET_RESOLVER | RegistryRolesLib.ROLE_SET_RESOLVER_ADMIN
        | RegistryRolesLib.ROLE_SET_SUBREGISTRY | RegistryRolesLib.ROLE_SET_SUBREGISTRY_ADMIN | ROLE_HEIR_CLAIM_ADMIN
        | ROLE_HEIR_REGISTERED_ADMIN;
}
