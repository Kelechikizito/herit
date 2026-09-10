// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import {IHeritRegistry} from "src/interfaces/IHeritRegistry.sol";

/// @dev Stands in for registry A. `HeritVault` asks it one question — who owns this estate —
///      and answers "nobody" for an estate that was never opened. Only `getOwner` is
///      implemented; the vault is cast to `IPermissionedRegistry` and calls nothing else, and
///      implementing the rest would be forty functions of noise.
contract MockGrantorRegistry {
    mapping(uint256 estateId => address owner) private s_owners;

    function setOwner(uint256 estateId, address owner) external {
        s_owners[estateId] = owner;
    }

    function getOwner(uint256 anyId) external view returns (address) {
        return s_owners[anyId];
    }
}

/// @dev Stands in for `HeritRegistry`, which does not exist until Checkpoint 7. The vault reads
///      status from it and nothing else, so a settable enum is the whole contract.
contract MockHeritRegistry {
    mapping(uint256 estateId => IHeritRegistry.Status status) private s_status;

    function setStatus(uint256 estateId, IHeritRegistry.Status status) external {
        s_status[estateId] = status;
    }

    function statusOf(uint256 estateId) external view returns (IHeritRegistry.Status) {
        return s_status[estateId];
    }

    function isAvailable(string calldata) external pure returns (bool) {
        return false;
    }

    /// @dev A no-op. `AccessControlGate.registerHeir` calls this on every heir, and the fork suite
    ///      exercises the ENS half of that, not Herit's share accounting.
    function recordHeir(uint256, string calldata, address, uint16) external {}
}

/// @dev A plain ERC20 with an open mint and a settable decimal count, so the suite can use a
///      6-decimal token like MockUSDC rather than only 18-decimal round numbers.
contract MockERC20 is ERC20 {
    uint8 private immutable I_DECIMALS;

    constructor(string memory name, string memory symbol, uint8 decimals_) ERC20(name, symbol) {
        I_DECIMALS = decimals_;
    }

    function decimals() public view override returns (uint8) {
        return I_DECIMALS;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/// @dev Burns a percentage of every transfer, the way a real fee-on-transfer token does. The vault
///      must credit what arrived, not what was asked for, or its books drift from its balance.
contract FeeOnTransferERC20 is ERC20 {
    /// @dev Basis points burned on each transfer. 1000 = 10%.
    uint256 public constant FEE_BPS = 1000;

    constructor() ERC20("Fee On Transfer", "FEE") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function _update(address from, address to, uint256 value) internal override {
        if (from == address(0) || to == address(0)) {
            super._update(from, to, value);
            return;
        }
        uint256 fee = (value * FEE_BPS) / 10_000;
        super._update(from, address(0), fee);
        super._update(from, to, value - fee);
    }
}

/// @dev An heir that is a contract wallet, not an EOA. Its `receive` deliberately writes storage,
///      which costs far more than the 2300 gas `transfer` forwards — so a vault that pays with
///      `transfer` instead of `call` fails against it.
contract ContractWalletHeir {
    uint256 public received;

    receive() external payable {
        received += msg.value;
    }
}

/// @dev An heir that cannot be paid in ETH. The vault must notice the failed send and revert
///      rather than marking the payout done and losing the money.
contract RejectingHeir {
    receive() external payable {
        revert("no thanks");
    }
}
