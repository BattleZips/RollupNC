const bigInt = require('big-integer')

/**
 * @title Layer 2 Transaction Class
 */
module.exports = class RollupTx {

    /// CIRCOMLIBJS HELPERS ///
    mimc7; // MiMC7 Hasher Object from circomlibjs
    eddsa; // EdDSA Signing Object from circomlibjs

    /// ACCOUNT STATE ///
    from; // Uint8Array[2]
    fromIndex; // bigint
    to; // Uint8Array[2]
    nonce; // bigint
    amount; // bigint
    tokenType; // bigint

    /// ACCOUNT CRYPTO ///
    root; // bigint
    signature; // { R8: bigint[2], S: bigint }


    /**
     * Create a new transaction object as stored
     * @param { Object } _mimc7 - the circomlibjs mimc7 hasher
     * @param { Object } _eddsa - the circomlibjs eddsa signer
     * @param { Uint8Array[2] } _from - the eddsa pubkey identifying account sending transaction
     * @param { bigInt } _fromIndex - the index of the sending account in the accounts tree
     * @param { Uint8Array[2] } _to - the eddsa pubkey identifying account receiving transaction
     * @param { bigInt } _nonce - the number of transactions sent by this account before this transaction
     * @param { bigInt } _amount - the number of tokens to transfer between accounts in this transaction
     * @param { bigInt } _tokenType - the token registry identifier of the ERC20 (or ether) being exchanged
     */
    constructor(_mimc7, _eddsa, _from, _fromIndex, _to, _nonce, _amount, _tokenType) {
        // assign circomlibjs helpers
        this.mimc7 = _mimc7;
        this.eddsa = _eddsa;
        // set transaction state
        this.from = _from;
        this.fromIndex = _fromIndex;
        this.to = _to;
        this.nonce = _nonce;
        this.amount = _amount;
        this.tokenType = _tokenType;
        // generate and set tx root hash
        this.root = this.hash();
    }

    /**
     * Generate a hash of the transaction to get the transaction leaf hash
     * @dev tx hash must be signed to verify authenticity
     * 
     * @return { bigint } - the MiMC7 hash of the transaction state
     */
    hash() {
        // convert pubkeys to bigints (pubkeys[0] & pubkeys[1]: from; pubkeys[2] & pubkeys[3]: to)
        const pubkeys = [...this.from, ...this.to].map(pubkey => bigInt(Buffer.from(pubkey).toString('hex'), 16));
        // container for data to hash
        const data = [
            pubkeys[0],
            pubkeys[1],
            this.fromIndex,
            pubkeys[2],
            pubkeys[3],
            this.nonce,
            this.amount,
            this.tokenType
        ].map(entry => entry.toString());
        return this.mimc7.multiHash(data);
    }

    /**
     * Add a signature to the transaction
     * 
     * @param { Buffer } prvkey - 32 byte eddsa key bufer
     */
    sign(prv) {
        this.signature = this.eddsa.signMiMC(prv, this.root);
    }

    /**
     * Determine the authenticity of the transaction signature
     * @return { boolean } true if signature authenticates transaction, and false otherwise
     */
    verify() {
        return this.eddsa.verifyMiMC(this.root, this.signature, this.from);
    }
}

