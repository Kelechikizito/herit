// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

interface IHeritRegistry {
    function isAvailable(string calldata label) external view returns (bool);
}
