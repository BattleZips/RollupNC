#!/bin/sh
set -e

# --------------------------------------------------------------------------------
# Phase 2
# ... circuit-specific stuff

# if zk/zkey does not exist, make folder
[ -d zk/zkey ] || mkdir zk/zkey

# Compile circuits
circom zk/circuits/update_state_verifier.circom -o zk/ --r1cs --wasm
circom zk/circuits/withdraw_signature_verifier.circom -o zk/ --r1cs --wasm

#Setup
yarn snarkjs groth16 setup zk/update_state_verifier.r1cs \
    zk/ptau/powersOfTau28_hez_final_20.ptau zk/zkey/update_state_verifier_final.zkey
yarn snarkjs groth16 setup zk/withdraw_signature_verifier.r1cs \
    zk/ptau/powersOfTau28_hez_final_20.ptau zk/zkey/withdraw_signature_verifier_final.zkey

# # Generate reference zkey
yarn snarkjs zkey new zk/update_state_verifier.r1cs \
    zk/ptau/powersOfTau28_hez_final_20.ptau zk/zkey/update_state_verifier_0000.zkey
yarn snarkjs zkey new zk/withdraw_signature_verifier.r1cs \
    zk/ptau/powersOfTau28_hez_final_20.ptau zk/zkey/withdraw_signature_verifier_0000.zkey

# # Ceremony just like before but for zkey this time
yarn snarkjs zkey contribute \
    zk/zkey/update_state_verifier_0000.zkey zk/zkey/update_state_verifier_0001.zkey \
    --name="First update_state_verifier contribution" -v -e="$(head -n 4096 /dev/urandom | openssl sha1)"
yarn snarkjs zkey contribute \
    zk/zkey/withdraw_signature_verifier_0000.zkey zk/zkey/withdraw_signature_verifier_0001.zkey \
    --name="First withdraw_signature_verifier contribution" -v -e="$(head -n 4096 /dev/urandom | openssl sha1)"
yarn snarkjs zkey contribute \
    zk/zkey/update_state_verifier_0001.zkey zk/zkey/update_state_verifier_0002.zkey \
    --name="Second update_state_verifier contribution" -v -e="$(head -n 4096 /dev/urandom | openssl sha1)"
yarn snarkjs zkey contribute \
    zk/zkey/withdraw_signature_verifier_0001.zkey zk/zkey/withdraw_signature_verifier_0002.zkey \
    --name="Second withdraw_signature_verifier contribution" -v -e="$(head -n 4096 /dev/urandom | openssl sha1)"
yarn snarkjs zkey contribute \
    zk/zkey/update_state_verifier_0002.zkey zk/zkey/update_state_verifier_0003.zkey \
    --name="Third update_state_verifier contribution" -v -e="$(head -n 4096 /dev/urandom | openssl sha1)"
yarn snarkjs zkey contribute \
    zk/zkey/withdraw_signature_verifier_0002.zkey zk/zkey/withdraw_signature_verifier_0003.zkey \
    --name="Third withdraw_signature_verifier contribution" -v -e="$(head -n 4096 /dev/urandom | openssl sha1)"


# #  Verify zkey
yarn snarkjs zkey verify \
    zk/update_state_verifier.r1cs zk/ptau/powersOfTau28_hez_final_20.ptau zk/zkey/update_state_verifier_0003.zkey
yarn snarkjs zkey verify \
    zk/withdraw_signature_verifier.r1cs zk/ptau/powersOfTau28_hez_final_20.ptau zk/zkey/withdraw_signature_verifier_0003.zkey

# # Apply random beacon as before
yarn snarkjs zkey beacon \
    zk/zkey/update_state_verifier_0003.zkey zk/zkey/update_state_verifier_final.zkey \
    0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f 10 -n="update_state_verifier Final Beacon phase2"
yarn snarkjs zkey beacon \
    zk/zkey/withdraw_signature_verifier_0003.zkey zk/zkey/withdraw_signature_verifier_final.zkey \
    0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f 10 -n="withdraw_signature_verifier Final Beacon phase2"


# # Optional: verify final zkey
yarn snarkjs zkey verify \
    zk/update_state_verifier.r1cs zk/ptau/powersOfTau28_hez_final_20.ptau zk/zkey/update_state_verifier_final.zkey
yarn snarkjs zkey verify \
    zk/withdraw_signature_verifier.r1cs zk/ptau/powersOfTau28_hez_final_20.ptau zk/zkey/withdraw_signature_verifier_final.zkey

# # Export verification key
yarn snarkjs zkey export verificationkey \
    zk/zkey/update_state_verifier_final.zkey zk/update_state_verifier_vkey.json
yarn snarkjs zkey export verificationkey \
    zk/zkey/withdraw_signature_verifier_final.zkey zk/withdraw_signature_verifier_vkey.json
# # Export board verifier with updated name and solidity version
# yarn snarkjs zkey export solidityverifier zk/zkey/board_final.zkey contracts/BoardVerifier.sol
# # sed -i'.bak' 's/0.6.11;/0.8.11;/g' contracts/BoardVerifier.sol
# sed -i'.bak' 's/contract Verifier/contract BoardVerifier/g' contracts/BoardVerifier.sol

# # Export shot verifier with updated name and solidity version
yarn snarkjs zkey export solidityverifier \
    zk/zkey/update_state_verifier_final.zkey contracts/UpdateStateVerifier.sol
yarn snarkjs zkey export solidityverifier \
    zk/zkey/withdraw_signature_verifier_final.zkey contracts/WithdrawSignaturerVerifier.sol
# # sed -i'.bak' 's/0.6.11;/0.8.11;/g' contracts/ShotVerifier.sol
# sed -i'.bak' 's/contract Verifier/contract ShotVerifier/g' contracts/ShotVerifier.sol
# rm contracts/*.bak
