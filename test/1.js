const { buildEddsa, buildPoseidonOpt } = require('circomlibjs');
const { wasm: wasm_tester } = require('circom_tester');
const { IncrementalMerkleTree } = require('@zk-kit/incremental-merkle-tree');
const { generateAccounts } = require('./utils')
const path = require('path');

describe('Circuit unit tests', async () => {
    let poseidon, eddsa, F; // circomlibjs objects
    let circuit; // circom_tester mock of circuit
    let accouns; // l1/l2 accounts
    let zeroCache; // cache tree level 0's
    before(async () => {
        poseidon = await buildPoseidonOpt();
        eddsa = await buildEddsa();
        F = poseidon.F;
        circuit = await wasm_tester(path.resolve('zk/circuits/update_state.circom'));
        accounts = await generateAccounts(poseidon, eddsa);
        zeroCache = [BigInt(0)];
        for (let i = 1; i <= 2; i++) {
            const root = zeroCache[i - 1];
            const internalNode = poseidon([root, root])
            zeroCache.push(F.toObject(internalNode));
        }
    })
    // it('This is my first unit test', async () => {
    //     // generate tx leaf
    //     const from = accounts.alice.L2.getPubkey();
    //     const to = accounts.bob.L2.getPubkey();
    //     const txHashArray = [
    //         ...from, // from addr
    //         0, // from index
    //         ...to, // to addr
    //         1, // nonce
    //         10, // amount
    //         1 // token type
    //     ]
    //     let txLeaf = poseidon(txHashArray)
        
    //     // sign tx leaf
    //     let signature = accounts.alice.L2.sign(txLeaf);
    //     txLeaf = F.toObject(txLeaf);
    //     signature = [...signature.R8.map(point => F.toObject(point)), signature.S];

    //     // generate merkle proof of inclusion for tx
    //     const tree = new IncrementalMerkleTree(poseidon, 2, BigInt(0));
    //     tree.insert(txLeaf);
    //     let { siblings, pathIndices } = tree.createProof(0);
    //     siblings[0] = siblings[0][0];
    //     for (let i = 1; i < siblings.length; i++)
    //         siblings[i] = F.toObject(siblings[i]);
    //     // DEBUG: manually log merkle tree steps
    //     const left = F.toObject(poseidon([txLeaf, zeroCache[0]]))
    //     const root = F.toObject(poseidon([left, zeroCache[1]]));
    //     const positions = [0, 0];
    //     const proof = [zeroCache[0], zeroCache[1]]
    //     // test circuit
    //     const witness = await circuit.calculateWitness({
    //         from,
    //         fromIndex: 0,
    //         to,
    //         nonce: 1,
    //         amount: 10,
    //         tokenType: 1,
    //         root: root,
    //         positions,
    //         proof,
    //         signature
    //     })
    // })
    it("")
})