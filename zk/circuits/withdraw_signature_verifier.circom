pragma circom 2.0.3;

include "../../node_modules/circomlib/circuits/eddsaposeidon.circom";

template Main(){

    signal input pubkey[2];
    signal input signature[3];

    component verifier = EdDSAPoseidonVerifier();   
    verifier.Ax <== pubkey[0];
    verifier.Ay <== pubkey[1];
    verifier.R8x <== signature[0];
    verifier.R8y <== signature[1];
    verifier.S <== signature[2];
}

component main { public [Ax, Ay, M] } = Main();