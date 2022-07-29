//SPDX-License-Identifier: GNU GPLv3
pragma solidity ^0.8.15;

/**
 * Interface definition for Groth16 proof verifier for update state verifier
 */
interface IUSV {
    function verifyProof(
        uint256[2] memory a,
        uint256[2][2] memory b,
        uint256[2] memory c,
        uint256[3] memory input
    ) external view returns (bool r);
}

/**
 * Interface definition for Groth16 proof verifier for withdraw signature verifier
 */
interface IWSV {
    function verifyProof(
        uint256[2] memory a,
        uint256[2][2] memory b,
        uint256[2] memory c,
        uint256[4] memory input
    ) external view returns (bool r);
}