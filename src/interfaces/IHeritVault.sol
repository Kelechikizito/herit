// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

interface IHeritVault {
    function deposit(uint256 estateId, address token, uint256 amount) external;

    function withdraw(uint256 estateId, address token, uint256 amount) external;
}
