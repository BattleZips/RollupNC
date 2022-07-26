pragma circom 2.0.3;

include "../../../node_modules/circomlib/circuits/poseidon.circom";

template BalanceLeaf() {

    signal input pubkey[2]; // Account EdDSA pubkey [x, y]
    signal input balance; // Account token balance
    signal input nonce; // Number of transactions made by the account
    signal input tokenType; // Token registry index for token type

    signal output out;

    component balanceLeaf = Poseidon(5);
    balanceLeaf.inputs[0] <== pubkey[0];
    balanceLeaf.inputs[1] <== pubkey[1];
    balanceLeaf.inputs[2] <== balance;
    balanceLeaf.inputs[3] <== nonce; 
    balanceLeaf.inputs[4] <== tokenType;

    out <== balanceLeaf.out;
}
