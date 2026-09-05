// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {
    IRegistry
} from "@ensdomains/contracts-v2/registry/interfaces/IRegistry.sol";
import {
    RegistryRolesLib
} from "@ensdomains/contracts-v2/registry/libraries/RegistryRolesLib.sol";
import {
    EACBaseRolesLib
} from "@ensdomains/contracts-v2/access-control/libraries/EACBaseRolesLib.sol";

contract Counter {
    uint256 public number;

    function setNumber(uint256 newNumber) public {
        number = newNumber;
    }

    function increment() public {
        number++;
    }
}
