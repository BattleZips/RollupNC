pragma circom 2.0.3;


include "../../../node_modules/circomlib/circuits/poseidon.circom";

template TxLeaf() {

    signal input from[2]; // Sender EdDSA pubkey [x, y]
    signal input fromIndex; // Sender index in balance tree
    signal input to[2]; // Receiver EdDSA pubkey [x, y]
    signal input nonce; // the sender's nonce for this tx
    signal input amount; // amount of tokens transfered
    signal input tokenType; // registry index for token type

    signal output out; // Transaction root to be used as merkle leaf

    component left = Poseidon(4);
    left.inputs[0] <== from[0];
    left.inputs[1] <== from[1];
    left.inputs[2] <== fromIndex;
    left.inputs[3] <== to[0];

    component right = Poseidon(4);
    right.inputs[0] <== to[1];
    right.inputs[1] <== nonce;
    right.inputs[2] <== amount;
    right.inputs[3] <== tokenType;
    
    component txLeaf = Poseidon(2);
    txLeaf.inputs[0] <== left.out;
    txLeaf.inputs[1] <== right.out;
    out <== txLeaf.out;
}
