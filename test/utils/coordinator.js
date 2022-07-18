const { IncrementalMerkleTree } = require('@zk-kit/incremental-merkle-tree');

module.exports = class L2Coordinator {

    /// CIRCOMLIBJS HELPERS ///
    poseidon; // Poseidon Hasher Object
    // eddsa; // EdDSA Signing/ Verification w. stored private key
    F; // Curve object from ffjavascript

    /// ON-CHAIN STATE ///
    signer; // signer that is RollupNC coordinator
    contract; // RollupNC.sol on-chain

    /// ACCOUNT STATE ///
    balanceTree; // Incremental Merkle Tree (used during updates)

    /// ACCOUNT CRYPTO ///
    // root; // bigint

    /**
     * Create new L2 Coordinator Object
     * 
     * @param _poseidon - the circomlibjs poseidon hasher object
     * @param _contract - the RollupNC contract deployed on-chain
     * @param _signer - the ethers wallet capable of acting as coordinator in _contract
     */
    constructor(_poseidon, _contract, _signer) {
        // assign helpers
        this.poseidon = _poseidon;
        this.contract = _contract;
        this.signer = _signer;
    }

    
}