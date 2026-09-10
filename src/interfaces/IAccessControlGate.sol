// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

interface IAccessControlGate {
    function isAuthorized(address user) external view returns (bool);
}
