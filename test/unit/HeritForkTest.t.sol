// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Test, console2} from "forge-std/Test.sol";

import {IPermissionedRegistry} from "@ensdomains/contracts-v2/registry/interfaces/IPermissionedRegistry.sol";
import {IVerifiableFactory} from "@ensdomains/verifiable-factory/IVerifiableFactory.sol";

import {AccessControlGate} from "src/AccessControlGate.sol";
import {HeritRolesLib} from "src/libraries/HeritRolesLib.sol";
import {IHeritRegistry} from "src/interfaces/IHeritRegistry.sol";
import {IUserRegistryInit} from "src/interfaces/IUserRegistryInit.sol";
import {MockHeritResolver} from "test/utils/MockHeritResolver.sol";

contract HeritForKTest is Test {
    /*//////////////////////////////////////////////////////////////
                            STATE VARIABLES
    //////////////////////////////////////////////////////////////*/

    /// @dev Frozen hackathon set, from `documents/deployments.md`, live on the fork.
    IVerifiableFactory internal constant FACTORY = IVerifiableFactory(0x894bc9cC8ff1ad96B8a288C86A8C71D662C07780);

    /// @dev The implementation every registry proxy in this test delegates to.
    address internal constant USER_REGISTRY_IMPL = 0x47B442d0CF617c41CAbAFf5f02f44DD1e5f72546;

    /// @dev Any value; the factory namespaces salts by `msg.sender`, so nothing here can collide.
    uint256 internal constant REGISTRY_A_SALT = uint256(keccak256("herit.registry-a.test"));

    /// @dev The grantor's label, so the estate id is `uint256(keccak256("alice"))`.
    string internal constant GRANTOR_LABEL = "alice";

    /// @dev The heir's label, registered inside registry B rather than registry A.
    string internal constant HEIR_LABEL = "son";

    /// @dev Written to the heir's `herit.relationship` record.
    string internal constant RELATIONSHIP = "son";

    /// @dev The heir's share in basis points, written to `herit.share`.
    uint16 internal constant SHARE_BPS = 6000;

    uint256 internal ethSepoliaFork;

    IPermissionedRegistry internal registryA;
    AccessControlGate internal gate;
    MockHeritResolver internal resolver;

    /// @dev Stands in for `HeritRegistry`, which does not exist yet; `unlockHeir` is pranked as it.
    address internal heritRegistry = makeAddr("heritRegistry");
    address internal alice = makeAddr("alice");
    address internal son = makeAddr("son");

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

        /// @dev One root role holder for registry A: this test contract, holding exactly what it will pass on to the gate.
        IUserRegistryInit.RoleAssignment[] memory roles = new IUserRegistryInit.RoleAssignment[](1);

        /// @dev `GATE_ROOT_ROLE_BITMAP` pairs every regular role with its admin half, so holding it is the right to grant it.
        roles[0] =
            IUserRegistryInit.RoleAssignment({account: address(this), roleBitmap: HeritRolesLib.GATE_ROOT_ROLE_BITMAP});

        /// @dev Registry A must exist before the gate, which takes it as an immutable constructor argument.
        registryA = IPermissionedRegistry(
            FACTORY.deployProxy(
                USER_REGISTRY_IMPL, REGISTRY_A_SALT, abi.encodeCall(IUserRegistryInit.initialize, (roles))
            )
        );

        /// @dev A stub resolver, because the deployed one does not expose the node-based setters the gate calls.
        resolver = new MockHeritResolver();

        /// @dev `namehash("herit.eth")`, derived rather than pasted so the two-step hash is visible.
        bytes32 heritNode =
            keccak256(abi.encodePacked(keccak256(abi.encodePacked(bytes32(0), keccak256("eth"))), keccak256("herit")));

        /// @dev The contract under test, wired to real ENS infrastructure and two stand-ins.
        gate = new AccessControlGate(
            FACTORY, USER_REGISTRY_IMPL, registryA, address(resolver), IHeritRegistry(heritRegistry), heritNode
        );

        /// @dev The grant the gate cannot make for itself on registry A; without it every later ENS call reverts.
        registryA.grantRootRoles(HeritRolesLib.GATE_ROOT_ROLE_BITMAP, address(gate));
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
        gate.openEstate(GRANTOR_LABEL, alice, expiry);

        /// @dev Only the owner of the name in registry A may add heirs beneath it.
        vm.prank(alice);

        /// @dev Registers the heir subname with `ROLE_HEIR_CLAIM` deliberately withheld.
        gate.registerHeir(estateId, HEIR_LABEL, son, RELATIONSHIP, SHARE_BPS, expiry);

        /// @dev The inheritance is dormant: the subname is the heir's, but the claim bit is not.
        assertFalse(gate.canClaim(estateId, HEIR_LABEL, son), "heir could claim before unlock");

        // ACT
        /// @dev Only `HeritRegistry` decides when an estate unlocks, so the call is made as it.
        vm.prank(heritRegistry);

        /// @dev The unlock, which is one `grantRoles` call inside the real ENS registry.
        gate.unlockHeir(estateId, HEIR_LABEL, son);

        // ASSERT
        /// @dev The withheld bit is now set, so `ClaimManager` will release funds to this heir.
        assertTrue(gate.canClaim(estateId, HEIR_LABEL, son), "heir cannot claim after unlock");
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
        address predicted = gate.predictEstateRegistry(estateId);

        // ACT
        /// @dev Deploying the estate is what turns the prediction into a real address.
        address estateRegistry = gate.openEstate(GRANTOR_LABEL, alice, expiry);

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
        IPermissionedRegistry estateRegistry = IPermissionedRegistry(gate.openEstate(GRANTOR_LABEL, alice, expiry));

        /// @dev Only the owner of the name in registry A may add heirs beneath it.
        vm.prank(alice);

        /// @dev Registers the heir subname with `ROLE_HEIR_CLAIM` deliberately withheld.
        gate.registerHeir(estateId, HEIR_LABEL, son, RELATIONSHIP, SHARE_BPS, expiry);

        /// @dev The token id as minted at registration, read by labelhash because the id itself is unstable.
        uint256 tokenBefore = estateRegistry.getTokenId(uint256(keccak256(bytes(HEIR_LABEL))));

        // ACT
        /// @dev Only `HeritRegistry` decides when an estate unlocks, so the call is made as it.
        vm.prank(heritRegistry);

        /// @dev The unlock, which is one `grantRoles` call inside the real ENS registry.
        gate.unlockHeir(estateId, HEIR_LABEL, son);

        // ASSERT
        /// @dev The same name under the same labelhash, now carrying a different token id.
        uint256 tokenAfter = estateRegistry.getTokenId(uint256(keccak256(bytes(HEIR_LABEL))));

        /// @dev Different ids prove the burn-and-remint happened, which is what makes caching one a bug.
        assertTrue(tokenBefore != tokenAfter, "heir token id survived unlock: _regenerate did not run");
    }
}
