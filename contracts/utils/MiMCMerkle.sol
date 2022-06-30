//SPDX-License-Identifier: GNU GPLv3
pragma solidity ^0.8.15;

import "../interfaces/IMiMCMerkle.sol";

/**
 * @title implementation of a merkle tree using the MiMC7 hash
 */
contract MiMCMerkle is IMiMCMerkle {

    constructor(address _mimc) {
        mimc = IMiMC(_mimc);
    }

    /**
     * Traverse merkle tree to reach a l
     */
    function getRootFromProof(
        uint256 _leaf,
        uint256[] memory _position,
        uint256[] memory _proof
    ) public view returns(uint) {

        uint256[] memory root = new uint256[](_proof.length);

        uint r = IV;

        // if leaf is left sibling
        if (_position[0] == 0){
            root[0] = mimc.MiMCpe7(mimc.MiMCpe7(r, _leaf), _proof[0]);
        }
        // if leaf is right sibling
        else if (_position[0] == 1){
            root[0] = mimc.MiMCpe7(mimc.MiMCpe7(r, _proof[0]), _leaf);
        }

        for (uint i = 1; i < _proof.length; i++){
            // if leaf is left sibling
            if (_position[i] == 0){
                root[i] = mimc.MiMCpe7(mimc.MiMCpe7(r, root[i - 1]), _proof[i]);
            }
            // if leaf is right sibling
            else if (_position[i] == 1){
                root[i] = mimc.MiMCpe7(mimc.MiMCpe7(r, _proof[i]), root[i - 1]);
            }
        }

        // return (_claimedRoot == root[root.length - 1]);
        return root[root.length - 1];

    }

    function hashMiMC(uint[] memory array) public view returns(uint){
        //[pubkey_x, pubkey_y, balance, nonce, token_type]
        uint r = IV;
        for (uint i = 0; i < array.length; i++){
            r = mimc.MiMCpe7(r, array[i]);
        }
        return r;
    }

}
