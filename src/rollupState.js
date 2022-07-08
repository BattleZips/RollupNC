import { IncrementalMerkleTree } from '@zk-kit/incremental-merkle-tree';

/**
 * @title Class for managing rollup state
 */
module.exports = class RollupState {

    /**
     * Instantiate new noncustodial rollup state manager class
     * 
     * @param { Object } _mimc7 - circomlibjs MiMC7 hasher object
     * @param { Object } _eddsa - circomlibjs EdDSA signer object
     * @param { number } _txDepth - the depth of the transaction merkle tree
     * @param { number } _balDepth - the depth of the account balance merkel tree
     */
    constructor(_mimc7, _eddsa, _txDepth = 4, _balDepth = 2) {

    }

}