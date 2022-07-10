import { IncrementalMerkleTree } from '@zk-kit/incremental-merkle-tree';

/**
 * @title Class for managing rollup state
 */
module.exports = class RollupState {

    mimc7; // circomlibjs:MiMC7
    eddsa; // circomlibjs:Eddsa
    txDepth; // number
    balDepth; // number
    txTree; // IncrementalMerkleTree
    balTree; // IncrementalMerkleTree

    /**
     * Instantiate new noncustodial rollup state manager class
     * 
     * @param { Object } _mimc7 - circomlibjs MiMC7 hasher object
     * @param { Object } _eddsa - circomlibjs EdDSA signer object
     * @param { number } _txDepth - the depth of the transaction merkle tree
     * @param { number } _balDepth - the depth of the account balance merkel tree
     */
    constructor(_mimc7, _eddsa, _txDepth = 4, _balDepth = 2) {
        // ensure integrity of tree depth
        if (_txDepth > 32 || _txDepth < 2) throw new Error(`Tx tree depth of ${_txDepth} is not in range [2, 32] `);
        if (_balDepth > 32 || _balDepth < 2) throw new Error(`Bal tree depth of ${_balDepth} is not in range [2, 32] `);


    }

}