// const mimcjs = require("../circomlib/src/mimc7.js");
// const eddsa = require("../circomlib/src/eddsa.js");
const { stringifyBigInts, unstringifyBigInts } = require('./todo/stringifybigint.js')

module.exports = class RollupTx {

    /// CIRCOMLIBJS HELPERS ///
    mimc7; // MiMC7 Hasher Object from circomlibjs
    eddsa; // EdDSA Signing Object from circomlibjs

    /// ACCOUNT STATE ///
    from; // bigint[2]
    fromIndex; // bigint
    to; // bigint[2]
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
     * @param { bigint[2] } _from - the eddsa pubkey identifying account sending transaction
     * @param { bigint } _fromIndex - the index of the sending account in the accounts tree
     * @param { bigint[2] } _to - the eddsa pubkey identifying account receiving transaction
     * @param { bigint } _nonce - the number of transactions sent by this account before this transaction
     * @param { bigint } _amount - the number of tokens to transfer between accounts in this transaction
     * @param { bigint } _tokenType - the token registry identifier of the ERC20 (or ether) being exchanged
     * @param { Object } _signature - the EdDSA signature by the sender authorizing the transaction
     */
    constructor(_mimc7, _eddsa, _from, _fromIndex, _to, _nonce, _amount, _tokenType, _signature) {
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
        const data = [
            this.from[0].toString(),
            this.from[1].toString(),
            this.fromIndex.toString(),
            this.to[0].toString(),
            this.to[1].toString(),
            this.nonce.toString(),
            this.amount.toString(),
            this.tokenType.toString()
        ]
        return this.mimc7.multiHash(data);
    }

    /**
     * Add a signature to the transaction
     * 
     * @param { bigint } prvkey - 32 byte eddsa key as bigint
     */
    sign(prvkey) {
        this.signature = eddsa.signMiMC(prvkey, unstringifyBigInts(this.hash.toString()));
    }

    /**
     * Determine the authenticity of the transaction signature
     * @return { boolean } true if signature authenticates transaction, and false otherwise
     */
    verify() {
        return eddsa.verifyMiMC(this.hash, this.signature, this.from);
    }

    /// TESTIN ///
    /**
     * test the way i wanna do it
     */
     sign1(prvkey) {
        console.log(eddsa.signMiMC(prvkey, this.hash));
    }

    /**
     * test the way its being done
     */
    sign2(prvkey) {
        this.signature = eddsa.signMiMC(prvkey, unstringifyBigInts(this.hash.toString()));
    }
}

