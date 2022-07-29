pragma circom 2.0.3;


include "./tx_leaf.circom";
include "./leaf_existence.circom";
include "../../../node_modules/circomlib/circuits/eddsaposeidon.circom";

template TxExistence(depth){

    /// SIGNALS IO ///

    // Transaction definition
    signal input from[2]; // Sender EdDSA pubkey [x, y]
    signal input fromIndex; // Sender index in balance tree
    signal input to[2]; // Receiver EdDSA pubkey [x, y]
    signal input nonce; // the sender's nonce for this tx
    signal input amount; // amount of tokens transfered
    signal input tokenType; // registry index for token type

    // Inclusion proof
    signal input root; // Transaction tree root
    signal input positions[depth]; // path to leaf being checked for inclusion
    signal input proof[depth]; // sibling nodes
    
    // Transaction signature
    signal input signature[3]; // EdDSA signature on tx leaf by Sender [R8x, R8y, S]
    

    /// COMPONENTS ///
    component leaf = TxLeaf(); // compute tx leaf root from full tx leaf definition
    component leafExistence = LeafExistence(depth); // constraint by merkle inclusion proof
    component eddsa = EdDSAPoseidonVerifier(); // constraint by eddsa signature

    /// CIRCUIT LOGIC ///

    // Compute tx leaf root
    leaf.from[0] <== from[0];
    leaf.from[1] <== from[1];
    leaf.fromIndex <== fromIndex;
    leaf.to[0] <== to[0];
    leaf.to[1] <== to[1];
    leaf.nonce <== nonce;
    leaf.amount <== amount;
    leaf.tokenType <== tokenType;

    // Confirm tx leaf root exists in tx tree root via merkle proof of inclusion
    leafExistence.leaf <== leaf.out;
    leafExistence.root <== root;
    for (var i = 0; i < depth; i++){
        leafExistence.positions[i] <== positions[i];
        leafExistence.proof[i] <== proof[i];
    }
    // Verify authenticity of transaction
    eddsa.enabled <== 1;
    eddsa.Ax <== from[0];
    eddsa.Ay <== from[1];
    eddsa.R8x <== signature[0];
    eddsa.R8y <== signature[1];
    eddsa.S <== signature[2];
    eddsa.M <== leaf.out;

}

