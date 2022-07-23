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

    component txLeaf = Poseidon(8);
    txLeaf.inputs[0] <== from[0];
    txLeaf.inputs[1] <== from[1];
    txLeaf.inputs[2] <== fromIndex;
    txLeaf.inputs[3] <== to[0];
    txLeaf.inputs[4] <== to[1]; 
    txLeaf.inputs[5] <== nonce;
    txLeaf.inputs[6] <== amount;
    txLeaf.inputs[7] <== tokenType;
    out <== txLeaf.out;
}
