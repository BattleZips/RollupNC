const bigInt = require('big-integer')
const { IncrementalMerkleTree } = require("@zk-kit/incremental-merkle-tree");
const { buildPoseidonOpt, buildEddsa } = require("circomlibjs");
const { ethers } = require('ethers')

/**
 * @title Class managing coordinator/ sequencer actions
 * Essentially a layer 2 network with only one node
 */
module.exports = class L2 {

    /// INSTANTIATION FUNCITONS ///
    /**
     * Create a new rollup instance
     * 
     * @param {string} deploymentAddress - ethereum address of deployed RollupNC instance
     * @param {ethers.Wallet} signer - the coordinator account
     * @param {number} balDepth - depth of balance merkle tree
     * @param {number} txDepth - depth of l2 transaction merkle tree
     * @param {bigint} zero - the value to use as zero root
     * @param {Object} poseidon - the circomlibjs poseidon object
     * @param {Object} eddsa - the circomlibjs eddsa object
     */
    constructor(deploymentAddress, signer, balDepth, txDepth, zero, poseidon, eddsa) {
        this.deploymentAddress = deploymentAddress;
        this.signer = signer;
        this.balDepth = balDepth;
        this.txDepth = txDepth;
        this.zero = zero;
        this.poseidon = poseidon;
        this.eddsa = eddsa;
        this.balTree = new IncrementalMerkleTree(this.poseidon, this.balDepth, this.zero);
        this.txTree = new IncrementalMerkleTree(this.poseidon, this.txDepth, this.zero);
    }

    /**
     * Asynchronous function to initialize circomlibjs curves
     * 
     * @param {string} deploymentAddress - ethereum address of deployed RollupNC instance
     * @param {ethers.Wallet} signer - the coordinator account
     * @param {number} balDepth - depth of balance merkle tree
     * @param {number} txDepth - depth of l2 transaction merkle tree
     * @param {bigint} zero - the value to use as zero root
     */
    static async new(deploymentAddress, signer, balDepth = 4, txDepth = 2, zero = BigInt(0)) {
        const poseidon = await buildPoseidonOpt();
        const eddsa = await buildEddsa();
        return new L2(
            deploymentAddress,
            signer,
            balDepth,
            txDepth,
            zero,
            poseidon,
            eddsa
        );
    }

    /// L1 FUNCTIONS ///
    /**
     * 
     */
    async processDeposits() {}

    /**
     * Approve a request for a token to be added to the 
     */
    async approveToken() {}
    async updateState() {}
    /// L2 FUNCTIONS ///
    

    /// INTERNAL FUNCTIONS ///
}