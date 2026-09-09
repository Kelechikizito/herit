// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

interface IHeritRegistry {
    /// @dev The estate state machine. `Active` while the grantor is checking in, `Grace` after a
    ///      missed window, `Unlocked` once grace has lapsed too. Only the last is irreversible.
    enum Status {
        Active,
        Grace,
        Unlocked
    }

    function isAvailable(string calldata label) external view returns (bool);

    /// @notice Where an estate sits in the state machine.
    /// @dev `HeritVault` reads this rather than keeping its own copy: deposits and withdrawals are
    ///      refused once an estate is `Unlocked`, and that decision belongs to one contract only.
    function statusOf(uint256 estateId) external view returns (Status);
}
