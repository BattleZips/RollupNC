pragma circom 2.0.3;

include "../../node_modules/circomlib/circuits/eddsaposeidon.circom";
include "../../node_modules/circomlib/circuits/poseidon.circom";

template Main(){

    signal input pubkey[2];
    signal input recipient;
    signal input nonce;
    signal input signature[3];

    component hasher = Poseidon(2);
    hasher.inputs[0] <== nonce;
    hasher.inputs[1] <== recipient;

    component eddsa = EdDSAPoseidonVerifier();
    eddsa.enabled <== 1;
    eddsa.Ax <== pubkey[0];
    eddsa.Ay <== pubkey[1];
    eddsa.R8x <== signature[0];
    eddsa.R8y <== signature[1];
    eddsa.S <== signature[2];
    eddsa.M <== hasher.out;
}

component main { public [pubkey, recipient, nonce] } = Main();