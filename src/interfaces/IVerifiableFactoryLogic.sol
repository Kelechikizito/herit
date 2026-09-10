// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

/// @notice The one `VerifiableFactory` getter that `IVerifiableFactory` leaves out.
/// @dev Every proxy the factory deploys is an EIP-1167 clone of this shared logic contract, so its
///      address is half of what is needed to recompute a proxy's CREATE2 address off-chain.
interface IVerifiableFactoryLogic {
    function proxyLogic() external view returns (address);
}
