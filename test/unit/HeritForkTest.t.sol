// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Test, console2} from "forge-std/Test.sol";

import {IPermissionedRegistry} from "@ensdomains/contracts-v2/registry/interfaces/IPermissionedRegistry.sol";
import {IVerifiableFactory} from "@ensdomains/verifiable-factory/IVerifiableFactory.sol";

import {AccessControlGate} from "src/AccessControlGate.sol";
import {HeritRolesLib} from "src/libraries/HeritRolesLib.sol";
import {IHeritRegistry} from "src/interfaces/IHeritRegistry.sol";
import {MockHeritRegistry} from "test/utils/VaultMocks.sol";
import {IUserRegistryInit} from "src/interfaces/IUserRegistryInit.sol";
import {IHeritResolver} from "src/interfaces/IHeritResolver.sol";
import {IPermissionedResolverInit} from "src/interfaces/IPermissionedResolverInit.sol";
import {IEnhancedAccessControl} from "@ensdomains/contracts-v2/access-control/interfaces/IEnhancedAccessControl.sol";
import {ITextResolver} from "@ens/contracts/resolvers/profiles/ITextResolver.sol";
import {NameCoder} from "@ens/contracts/utils/NameCoder.sol";

contract HeritForKTest is Test {
    /*//////////////////////////////////////////////////////////////
                            STATE VARIABLES
    //////////////////////////////////////////////////////////////*/

    /// @dev Frozen hackathon set, from `documents/deployments.md`, live on the fork.
    IVerifiableFactory internal constant FACTORY = IVerifiableFactory(0x894bc9cC8ff1ad96B8a288C86A8C71D662C07780);

    /// @dev The implementation every registry proxy in this test delegate to.
    address internal constant USER_REGISTRY_IMPL = 0x47B442d0CF617c41CAbAFf5f02f44DD1e5f72546;

    /// @dev The resolver implementation, from the same frozen set. Name-based setters only.
    address internal constant PERMISSIONED_RESOLVER_IMPL = 0xa9d3814AB151BF6E37A427432795371a8361614e;

    /// @dev Any value; the factory namespaces salts by `msg.sender`, so nothing here can collide.
    uint256 internal constant REGISTRY_A_SALT = uint256(keccak256("herit.registry-a.test"));

    /// @dev A separate salt, because the same one cannot deploy two proxies from this contract.
    uint256 internal constant RESOLVER_SALT = uint256(keccak256("herit.resolver.test"));

    /// @dev `herit.eth` DNS-encoded. The gate keeps its own private copy; this one is independent
    ///      on purpose, so a typo there cannot cancel itself out against a typo here.
    bytes internal constant HERIT_NAME = hex"0568657269740365746800";

    /// @dev The grantor's label, so the estate id is `uint256(keccak256("alice"))`.
    string internal constant GRANTOR_LABEL = "alice";

    /// @dev The heir's label, registered inside registry B rather than registry A.
    string internal constant HEIR_LABEL = "son";

    /// @dev Written to the heir's `herit.relationship` record.
    string internal constant RELATIONSHIP = "son";

    string internal constant SECOND_HEIR_LABEL = "daughter";

    string internal constant SECOND_RELATIONSHIP = "daughter";

    /// @dev The heir's share in basis points, written to `herit.share`.
    uint16 internal constant SHARE_BPS = 6000;

    uint16 internal constant SECOND_SHARE_BPS = 4000;

    uint256 internal ethSepoliaFork;

    IPermissionedRegistry internal registryA;
    AccessControlGate internal accessControlGate;

    /// @dev A real `PermissionedResolver` proxy on the fork, not a stub. The stub it replaced
    ///      implemented the namehash-based setters the deployed contract does not have, so it
    ///      accepted calls the real chain rejects and proved nothing.
    IHeritResolver internal resolver;

    /// @dev Stands in for `HeritRegistry`, which does not exist yet; `unlockHeir` is pranked as it.
    address internal heritRegistry = makeAddr("heritRegistry");
    address internal alice = makeAddr("alice");
    address internal son = makeAddr("son");
    address internal daughter = makeAddr("daughter");

    /*//////////////////////////////////////////////////////////////
                                 SETUP
    //////////////////////////////////////////////////////////////*/

    function setUp() public {
        /// @dev Read the RPC URL directly rather than by alias, so its absence is detectable.
        string memory rpc = vm.envOr("ETH_SEPOLIA_RPC_URL", string(""));

        /// @dev CI has no RPC URL, so skip the whole file there instead of failing the build.
        if (bytes(rpc).length == 0) {
            vm.skip(true);
            return;
        }

        /// @dev Fork Sepolia, because the deployed ENSv2 contracts differ from the pinned submodule.
        ethSepoliaFork = vm.createSelectFork(rpc);

        /// @dev Both addresses carry live EIP-7702 delegations on Sepolia, which make the ERC-1155 mint in `register` revert.
        vm.etch(alice, "");
        vm.etch(son, "");
        vm.etch(daughter, "");

        /// @dev One root role holder for registry A: this test contract, holding exactly what it will pass on to the accessControlGate.
        IUserRegistryInit.RoleAssignment[] memory roles = new IUserRegistryInit.RoleAssignment[](1);

        /// @dev `GATE_ROOT_ROLE_BITMAP` pairs every regular role with its admin half, so holding it is the right to grant it.
        roles[0] =
            IUserRegistryInit.RoleAssignment({account: address(this), roleBitmap: HeritRolesLib.GATE_ROOT_ROLE_BITMAP});

        /// @dev Registry A must exist before the accessControlGate, which takes it as an immutable constructor argument.
        registryA = IPermissionedRegistry(
            FACTORY.deployProxy(
                USER_REGISTRY_IMPL, REGISTRY_A_SALT, abi.encodeCall(IUserRegistryInit.initialize, (roles))
            )
        );

        /// @dev The same bootstrap as registry A: this test holds the roles first, then hands them
        ///      to the gate, because the gate takes the resolver's address as an immutable.
        IPermissionedResolverInit.RoleAssignment[] memory resolverRoles =
            new IPermissionedResolverInit.RoleAssignment[](1);
        resolverRoles[0] = IPermissionedResolverInit.RoleAssignment({
            account: address(this), roleBitmap: HeritRolesLib.GATE_RESOLVER_ROLE_BITMAP
        });

        /// @dev The second initializer argument's purpose is unconfirmed; empty is what the gate needs.
        resolver = IHeritResolver(
            FACTORY.deployProxy(
                PERMISSIONED_RESOLVER_IMPL,
                RESOLVER_SALT,
                abi.encodeCall(IPermissionedResolverInit.initialize, (resolverRoles, new bytes[](0)))
            )
        );

        /// @dev `registerHeir` calls `HeritRegistry.recordHeir`, so the stand-in needs code. The
        ///      address stays the one `makeAddr` produced, because `unlockHeir` is pranked as it.
        vm.etch(heritRegistry, address(new MockHeritRegistry()).code);

        /// @dev The contract under test, wired to real ENS infrastructure and one stand-in.
        accessControlGate = new AccessControlGate(
            FACTORY, USER_REGISTRY_IMPL, registryA, address(resolver), IHeritRegistry(heritRegistry)
        );

        /// @dev The grant the accessControlGate cannot make for itself on registry A; without it every later ENS call reverts.
        registryA.grantRootRoles(HeritRolesLib.GATE_ROOT_ROLE_BITMAP, address(accessControlGate));

        /// @dev The same grant on the resolver. Its roles come from `PermissionedResolverLib`, a
        ///      different set from the registry's, so this is a second bitmap and not a repeat.
        IEnhancedAccessControl(address(resolver))
            .grantRootRoles(HeritRolesLib.GATE_RESOLVER_ROLE_BITMAP, address(accessControlGate));
    }

    /*//////////////////////////////////////////////////////////////
                                 TESTS
    //////////////////////////////////////////////////////////////*/

    /// @notice The whole product in one test: an heir cannot claim until the estate unlocks, and can afterwards.
    /// @dev The false assertion carries the weight — a test that only checks the end state passes just as
    ///      happily if `ROLE_HEIR_CLAIM` was granted at registration, which would hand every heir their
    ///      inheritance on day one while the estate still looks locked.
    function testHappyPath() public {
        // ARRANGE
        /// @dev Real Sepolia time on the fork, not zero, so the estate outlives `block.timestamp`.
        uint64 expiry = uint64(block.timestamp + 365 days);

        /// @dev The estate id is the grantor's labelhash, the same value the registry accepts as `anyId`.
        uint256 estateId = uint256(keccak256(bytes(GRANTOR_LABEL)));

        /// @dev Onboards the grantor: registers `alice` in registry A and deploys her estate registry.
        accessControlGate.openEstate(GRANTOR_LABEL, alice, expiry);

        /// @dev Only the owner of the name in registry A may add heirs beneath it.
        vm.prank(alice);

        /// @dev Registers the heir subname with `ROLE_HEIR_CLAIM` deliberately withheld.
        accessControlGate.registerHeir(estateId, HEIR_LABEL, son, RELATIONSHIP, SHARE_BPS, expiry);

        vm.prank(alice);
        accessControlGate.registerHeir(
            estateId, SECOND_HEIR_LABEL, daughter, SECOND_RELATIONSHIP, SECOND_SHARE_BPS, expiry
        );

        /// @dev The inheritance is dormant: the subname is the heir's, but the claim bit is not.
        assertFalse(accessControlGate.canClaim(estateId, HEIR_LABEL, son), "heir could claim before unlock");
        assertFalse(
            accessControlGate.canClaim(estateId, SECOND_HEIR_LABEL, daughter), "second heir could claim before unlock"
        );

        // ACT
        /// @dev Only `HeritRegistry` decides when an estate unlocks, so the call is made as it.
        vm.prank(heritRegistry);

        /// @dev The unlock, which is one `grantRoles` call inside the real ENS registry.
        accessControlGate.unlockHeir(estateId, HEIR_LABEL, son);

        vm.prank(heritRegistry);
        accessControlGate.unlockHeir(estateId, SECOND_HEIR_LABEL, daughter);

        // ASSERT
        /// @dev The withheld bit is now set, so `ClaimManager` will release funds to this heir.
        assertTrue(accessControlGate.canClaim(estateId, HEIR_LABEL, son), "heir cannot claim after unlock");
        assertTrue(
            accessControlGate.canClaim(estateId, SECOND_HEIR_LABEL, daughter), "second heir cannot claim after unlock"
        );
    }

    /// @notice The estate registry address the frontend shows before payment is the one that gets deployed.
    /// @dev `predictEstateRegistry` reimplements the factory's CREATE2 arithmetic by hand, so if the two
    ///      derivations drift nothing reverts — the UI simply shows an address that never comes to exist.
    function testEstateRegistryMatchesPrediction() public {
        // ARRANGE
        /// @dev Real Sepolia time on the fork, not zero, so the estate outlives `block.timestamp`.
        uint64 expiry = uint64(block.timestamp + 365 days);

        /// @dev The estate id is the grantor's labelhash, the same value the registry accepts as `anyId`.
        uint256 estateId = uint256(keccak256(bytes(GRANTOR_LABEL)));

        /// @dev Read the predicted address first, while the estate still does not exist.
        address predicted = accessControlGate.predictEstateRegistry(estateId);

        // ACT
        /// @dev Deploying the estate is what turns the prediction into a real address.
        address estateRegistry = accessControlGate.openEstate(GRANTOR_LABEL, alice, expiry);

        // ASSERT
        /// @dev Same salt, same logic contract, same factory, so the two must agree exactly.
        assertEq(estateRegistry, predicted, "estate registry did not land at the predicted address");
    }

    /// @notice Unlocking burns and re-mints the heir's subname, so its token id must never be cached.
    /// @dev Every grant and revoke goes through `_regenerate`, which is easy to forget precisely because
    ///      nothing reverts when it is forgotten; a stored token id simply goes stale at unlock.
    function testUnlockRegeneratesHeirToken() public {
        // ARRANGE
        /// @dev Real Sepolia time on the fork, not zero, so the estate outlives `block.timestamp`.
        uint64 expiry = uint64(block.timestamp + 365 days);

        /// @dev The estate id is the grantor's labelhash, the same value the registry accepts as `anyId`.
        uint256 estateId = uint256(keccak256(bytes(GRANTOR_LABEL)));

        /// @dev Registry B, since heir subnames live in the estate's own registry, not registry A.
        IPermissionedRegistry estateRegistry =
            IPermissionedRegistry(accessControlGate.openEstate(GRANTOR_LABEL, alice, expiry));

        /// @dev Only the owner of the name in registry A may add heirs beneath it.
        vm.prank(alice);

        /// @dev Registers the heir subname with `ROLE_HEIR_CLAIM` deliberately withheld.
        accessControlGate.registerHeir(estateId, HEIR_LABEL, son, RELATIONSHIP, SHARE_BPS, expiry);

        /// @dev The token id as minted at registration, read by labelhash because the id itself is unstable.
        uint256 tokenBefore = estateRegistry.getTokenId(uint256(keccak256(bytes(HEIR_LABEL))));

        // ACT
        /// @dev Only `HeritRegistry` decides when an estate unlocks, so the call is made as it.
        vm.prank(heritRegistry);

        /// @dev The unlock, which is one `grantRoles` call inside the real ENS registry.
        accessControlGate.unlockHeir(estateId, HEIR_LABEL, son);

        // ASSERT
        /// @dev The same name under the same labelhash, now carrying a different token id.
        uint256 tokenAfter = estateRegistry.getTokenId(uint256(keccak256(bytes(HEIR_LABEL))));

        /// @dev Different ids prove the burn-and-remint happened, which is what makes caching one a bug.
        assertTrue(tokenBefore != tokenAfter, "heir token id survived unlock: _regenerate did not run");
    }

    /// @notice The two text records exist on the real resolver and read back through `resolve`.
    /// @dev This is the ENS submission in one test. The build plan's demo shows `herit.relationship`
    ///      and `herit.share` on the heir's subname, and the deployed resolver has no
    ///      `text(bytes32,string)` entrypoint to read them with — `resolve` is the only read it
    ///      exposes. Asserting through it here is what stops that being discovered while recording.
    ///
    ///      The name is rebuilt from literals rather than read off the gate, so a mistake in
    ///      `AccessControlGate._heirName` shows up as a failure here instead of cancelling itself
    ///      out on both sides.
    function testHeirRecordsReadBackFromTheRealResolver() public {
        // ARRANGE
        uint64 expiry = uint64(block.timestamp + 365 days);
        uint256 estateId = uint256(keccak256(bytes(GRANTOR_LABEL)));

        accessControlGate.openEstate(GRANTOR_LABEL, alice, expiry);

        vm.prank(alice);
        accessControlGate.registerHeir(estateId, HEIR_LABEL, son, RELATIONSHIP, SHARE_BPS, expiry);

        /// @dev `son.alice.herit.eth`, DNS-encoded: `\x03son\x05alice\x05herit\x03eth\x00`.
        bytes memory heirName = NameCoder.addLabel(NameCoder.addLabel(HERIT_NAME, GRANTOR_LABEL), HEIR_LABEL);

        /// @dev The same name hashed. `resolve` takes the DNS form outside and the namehash inside.
        bytes32 heirNode = NameCoder.namehash(heirName, 0);

        // ACT
        bytes memory relationshipResult = resolver.resolve(
            heirName, abi.encodeWithSelector(ITextResolver.text.selector, heirNode, "herit.relationship")
        );
        bytes memory shareResult =
            resolver.resolve(heirName, abi.encodeWithSelector(ITextResolver.text.selector, heirNode, "herit.share"));

        // ASSERT
        assertEq(abi.decode(relationshipResult, (string)), RELATIONSHIP, "herit.relationship did not read back");
        assertEq(abi.decode(shareResult, (string)), "6000", "herit.share did not read back");
    }
}
