const ZERO = BigInt(0);

/**
 * @title Offchain (EdDSA) account state
 */
module.exports = class RollupAccount {

    /// CIRCOMLIBJS HELPERS ///
    mimc7; // MiMC7 Hasher Object

    /// ACCOUNT STATE ///
    index; // bigint
    pubkey; // bigint[2]
    balance; // bigint;
    nonce; // bigint;
    tokenType; // bigint

    /// ACCOUNT CRYPTO ///
    root; // bigint

    /**
     * Construct a new account stored in account tree leaves
     * 
     * @param { Object } _mimc7 - the circomlibjs mimc7 hasher
     * @param { bigint } _index - the account tree leaf index
     * @param { bigint[2] }_pubkey- two 32 byte strings that form a single EdDSA key
     * @param { bigint } _balance - the amount of tokens held by this account
     * @param { bigint } _nonce - the number of transactions this account has sent
     * @param { bigint } _tokenType - the type of ERC20 (or ether) being held in this account
     * @return { L2Account } - initialized L2 account class
     */
    constructor(_mimc7, _index, _pubkey, _balance, _nonce, _tokenType) {
        // assign circomlibjs helpers
        this.mimc7 = _mimc7;
        // set account state
        this.index = _index;
        this.pubkey = _pubkey;
        this.balance = _balance;
        this.nonce = _nonce;
        this.tokenType = _tokenType;
        // generate and set account root hash
        this.root = this.hash();
    }

    /** 
     * Return an empty account
     * @param { Object } _mimc7 - the circomlibjs mimc7 hasher
     * @return { L2Account }- empty initialized account
     */
    static getEmptyAccount(_mimc7) {
        return new RollupAccount(_mimc7, ZERO, [ZERO, ZERO], ZERO, ZERO, ZERO);
    }

    /**
     * Generate a hash of the account to get the account leaf hash
     * 
     * @return { bigint } - the MiMC7 hash of the account state
     */
    hash() {
        const data = [
            this.pubkey[0].toString(),
            this.pubkey[1].toString(),
            this.balance.toString(),
            this.nonce.toString(),
            this.tokenType.toString()
        ]
        return this.mimc7.multiHash(data);
    }

    /**
     * Debit balance from the account & increase nonce
     * @param { bigint } _amount - the amount of tokens being withdrawn from the account
     */
    debit(_amount) {
        this.balance -= _amount;
        this.nonce += 1;
        this.root = this.hash();
    }

    /**
     * Credit balance in the account
     * @param { bigint } _amount - the amount of tokens being deposited in the account
     */
    credit(_acount) {
        this.balance += _amount;
        this.root = this.hash();
    }
}




