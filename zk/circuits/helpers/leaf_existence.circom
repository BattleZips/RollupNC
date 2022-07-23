pragma circom 2.0.3;

include "./get_merkle_root.circom";

template LeafExistence(depth){
// k: tree depth
// Constrain proof to a given leaf that can be proven to exist in the given root
    signal input leaf; 
    signal input root;
    signal input proof[depth];
    signal input positions[depth];

    component computedRoot = GetMerkleRoot(depth);
    computedRoot.leaf <== leaf;

    for (var i = 0; i < depth; i++){
        computedRoot.proof[i] <== proof[i];
        computedRoot.positions[i] <== positions[i];
    }
    // equality constraint
    root === computedRoot.out;
}

