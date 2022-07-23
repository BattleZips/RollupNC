pragma circom 2.0.3;

include "./balance_leaf.circom";
include "./leaf_existence.circom";

template BalanceExistence(k){

    signal input pubkey[2]; // Account EdDSA pubkey [x, y]
    signal input balance; // Account token balance
    signal input nonce; // Number of transactions made by the account
    signal input tokenType; // Token registry index for token type

    signal input balanceRoot; // root of balance tree
    signal input position[k]; // balance tree traversal path to leaf checked for inclusion
    signal input proof[k]; // siblings proving leaf inclusion

    component balanceLeaf = BalanceLeaf();
    balanceLeaf.pubkey[0] <== pubkey[0];
    balanceLeaf.pubkey[1] <== pubkey[1];
    balanceLeaf.balance <== balance;
    balanceLeaf.nonce <== nonce; 
    balanceLeaf.tokenType <== tokenType;

    component balanceExistence = LeafExistence(k);
    balanceExistence.leaf <== balanceLeaf.out;
    balanceExistence.root <== balanceRoot;

    for (var s = 0; s < k; s++){
        balanceExistence.position[s] <== position[s];
        balanceExistence.proof[s] <== proof[s];
    }


}