pragma circom 2.0.3;

include "../../../node_modules/circomlib/circuits/poseidon.circom";

template GetMerkleRoot(depth){
// compute a merkle root for a given leaf with included proof and tree traversal parameters

    signal input leaf; // leaf root being included
    signal input proof[depth]; // sibling node values
    signal input positions[depth]; // position in binary tree

    signal output out;

    // hash of first two entries in tx Merkle proof
    component merkleRoot[depth];
    merkleRoot[0] = Poseidon(2);
    merkleRoot[0].inputs[0] <== leaf - positions[0] * (leaf - proof[0]);
    merkleRoot[0].inputs[1] <== proof[0] - positions[0] * (proof[0] - leaf);

    // hash of all other entries in tx Merkle proof
    for (var i = 1; i < depth; i++){
        merkleRoot[i] = Poseidon(2);
        merkleRoot[i].inputs[0] <== merkleRoot[i-1].out - positions[i] * (merkleRoot[i-1].out - proof[i]);
        merkleRoot[i].inputs[1] <== proof[i] - positions[i] * (proof[i] - merkleRoot[i-1].out);
    }
    // output computed Merkle root
    out <== merkleRoot[depth-1].out;

}