//SPDX-License-Identifier: GNU GPLv3
pragma solidity ^0.8.15;

/* Reference Poseidon hasher library contract using 2 inputs */
library PoseidonT3 {
    function poseidon(uint256[2] memory) public pure returns (uint256) {}
}

/* Reference Poseidon hasher library contract using 4 inputs (account hash) */
library PoseidonT5 {
    function poseidon(uint256[4] memory) public pure returns (uint256) {}
}

/* Reference Poseidon hasher library contract using 5 inputs (account hash) */
library PoseidonT6 {
    function poseidon(uint256[5] memory) public pure returns (uint256) {}
}