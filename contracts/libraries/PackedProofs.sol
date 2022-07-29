//SPDX-License-Identifier: GNU GPLv3
pragma solidity ^0.8.15;

/**
 * @title Handle no 2d function params for public calls with snark verifiers taking 2d input
 * @notice https://github.com/graphprotocol/graph-cli/issues/342#issuecomment-1004299760
 */
library PackedProofs {

    /* The data marshalled into Circom's preferred format*/
    struct UnpackedProof {
        uint256[2] a;
        uint256[2][2] b;
        uint256[2] c;
    }

    /**
     * Unpack a given array of packed pairings and marshal into structured data type
     * @param _data - array of curve points to deserialize
     * @return _unpacked - the zk verifier-friendly representation of the data
     */
    function unpack(uint256[8] memory _data)
        public
        pure
        returns (UnpackedProof memory _unpacked)
    {
        _unpacked.a = [_data[0], _data[1]];
        _unpacked.b[0] = [_data[2], _data[3]];
        _unpacked.b[1] = [_data[4], _data[5]];
        _unpacked.c = [_data[6], _data[7]];
    }
}
