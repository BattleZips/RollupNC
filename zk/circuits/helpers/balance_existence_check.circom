pragma circom 2.0.3;

include "./balance_leaf.circom";
include "./leaf_existence.circom";

template BalanceExistence(depth){

    signal input pubkey[2]; // Account EdDSA pubkey [x, y]
    signal input balance; // Account token balance
    signal input nonce; // Number of transactions made by the account
    signal input tokenType; // Token registry index for token type

    signal input root; // root of balance tree
    signal input positions[depth]; // balance tree traversal path to leaf checked for inclusion
    signal input proof[depth]; // siblings proving leaf inclusion

    component balanceLeaf = BalanceLeaf();
    balanceLeaf.pubkey[0] <== pubkey[0];
    balanceLeaf.pubkey[1] <== pubkey[1];
    balanceLeaf.balance <== balance;
    balanceLeaf.nonce <== nonce; 
    balanceLeaf.tokenType <== tokenType;
    component balanceExistence = LeafExistence(depth);
    balanceExistence.leaf <== balanceLeaf.out;
    balanceExistence.root <== root;

    for (var i = 0; i < depth; i++) {
        balanceExistence.positions[i] <== positions[i];
        balanceExistence.proof[i] <== proof[i];
    }


}