//SPDX-License-Identifier: GNU GPLv3
pragma solidity ^0.8.15;

/**
 * Interface definition for Groth16 proof verifier
 * @dev coincidence that both proofs have input size 3 - cannot always use same interface
 */
interface IVerifier {
    function verifyProof(
        uint256[2] memory a,
        uint256[2][2] memory b,
        uint256[2] memory c,
        uint256[3] memory input
    ) external view returns (bool r);
}