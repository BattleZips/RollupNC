const { ethers } = require('hardhat')
const snarkjs = require('snarkjs')
const { wasm: wasm_tester } = require('circom_tester');
const { solidity } = require("ethereum-waffle");
const { buildEddsa, buildPoseidon } = require('circomlibjs')
const { expect } = require("chai").use(solidity)
const { 
    initializeContracts,
    generateAccounts,
    L2Account,
    buildProofArgs
} = require('./utils')
const { IncrementalMerkleTree } = require('@zk-kit/incremental-merkle-tree');
const path = require('path');

describe("Test rollup deposits", async () => {
    let eddsa, poseidon, F, _poseidon; // circomlibjs objects
    let signers, accounts; // ecdsa/ eddsa wallets
    let zeroCache; // cache balance tree zeros
    let tree, subtree, root; // persist outside single unit test scope
    let rollup; // on-chain contract
    let stateCircuit, withdrawCircuit; // circom tester


    before(async () => {

        // initial
        signers = await ethers.getSigners();
        poseidon = await buildPoseidon();
        eddsa = await buildEddsa();
        F = poseidon.F;
        _poseidon = (data) => F.toObject(poseidon(data));
        stateCircuit = await wasm_tester(path.resolve('zk/circuits/update_state_verifier.circom'));
        withdrawCircuit = await wasm_tester(path.resolve('zk/circuits/withdraw_signature_verifier.circom'));

        // generate zero cache
        const depths = [4, 2];
        zeroCache = [BigInt(0)];
        for (let i = 1; i <= depths[0]; i++) {
            const root = zeroCache[i - 1];
            const internalNode = poseidon([root, root])
            zeroCache.push(F.toObject(internalNode));
        }
        rollup = await initializeContracts(zeroCache);
        // set accounts
        accounts = await generateAccounts(poseidon, eddsa);

    })
    describe('Deposits', async () => {
        describe('Batch #1', async () => {
            it('Deposit #0 (0 ADDRESS)', async () => {
                // check deposit fn execution logic
                const tx = rollup.deposit([0, 0], 0, 0, { from: accounts.coordinator.L1.address });
                await expect(tx).to.emit(rollup, 'RequestDeposit').withArgs([0, 0], 0, 0);
                // check deposit queue
                const expectedRoot = L2Account.emptyRoot(poseidon);
                const depositRoot = F.toObject((await rollup.describeDeposits())._leaves[0]);
                expect(expectedRoot).to.be.equal(depositRoot);
            })
            it('Deposit #1 (COORDINATOR ADDRESS)', async () => {
                // check deposit fn execution logic
                const l2Pubkey = accounts.coordinator.L2.pubkey.map(point => F.toObject(point));
                const tx = rollup.deposit(l2Pubkey, 0, 0, { from: accounts.coordinator.L1.address });
                await expect(tx).to.emit(rollup, 'RequestDeposit').withArgs(l2Pubkey, 0, 0);
                // check deposit queue
                const data = [...l2Pubkey, 0, 0, 0];
                const leafRoot = F.toObject(poseidon(data));
                const sibling = L2Account.emptyRoot(poseidon);
                const expectedRoot = F.toObject(poseidon([sibling, leafRoot]));
                const depositRoot = F.toObject((await rollup.describeDeposits())._leaves[0]);
                expect(expectedRoot).to.be.equal(depositRoot);
            })
            it('Deposit #2 (Alice)', async () => {
                // check deposit fn execution logic
                const l2Pubkey = accounts.alice.L2.pubkey.map(point => F.toObject(point));
                const tx = rollup.connect(accounts.alice.L1).deposit(l2Pubkey, 20, 1, { value: 20 });
                await expect(tx).to.emit(rollup, 'RequestDeposit').withArgs(l2Pubkey, 20, 1);
                accounts.alice.L2.credit(BigInt(20));
                // check deposit queue
                const expectedRoot = accounts.alice.L2.root;
                const depositRoot = F.toObject((await rollup.describeDeposits())._leaves[1]);
                expect(expectedRoot).to.be.equal(depositRoot);
            })
            it('Deposit #3 (Bob)', async () => {
                // check deposit fn execution logic
                const l2Pubkey = accounts.bob.L2.pubkey.map(point => F.toObject(point));
                const tx = rollup.connect(accounts.bob.L1).deposit(l2Pubkey, 15, 1, { value: 15 });
                await expect(tx).to.emit(rollup, 'RequestDeposit').withArgs(l2Pubkey, 15, 1);
                accounts.bob.L2.credit(BigInt(15));
                // check deposit queue
                const coordinatorPubkey = accounts.coordinator.L2.pubkey.map(point => F.toObject(point));
                const coordinatorLeaf = poseidon([...coordinatorPubkey, 0, 0, 0]);
                const sibling = poseidon([L2Account.emptyRoot(poseidon), coordinatorLeaf])
                const current = poseidon([accounts.alice.L2.root, accounts.bob.L2.root]);
                const expectedRoot = F.toObject(poseidon([sibling, current]));
                const depositRoot = F.toObject((await rollup.describeDeposits())._leaves[0]);
                subtree = depositRoot;
                expect(expectedRoot).to.be.equal(depositRoot);
            })
            it('Process Batch #1 (4 new balance leaves)', async () => {
                // construct expected values
                const emptyLeaf = L2Account.emptyRoot(poseidon)
                const coordinatorPubkey = accounts.coordinator.L2.pubkey.map(point => F.toObject(point));
                const coordinatorLeaf = poseidon([...coordinatorPubkey, 0, 0, 0]);
                tree = new IncrementalMerkleTree(_poseidon, 4, 0);
                tree.insert(emptyLeaf);
                tree.insert(F.toObject(coordinatorLeaf));
                tree.insert(accounts.alice.L2.root);
                tree.insert(accounts.bob.L2.root);
                const expected = {
                    oldRoot: zeroCache[zeroCache.length - 1],
                    newRoot: tree.root
                }
                // construct transaction
                const position = [0, 0];
                const proof = [zeroCache[2], zeroCache[3]];
                const tx = rollup.connect(accounts.coordinator.L1).processDeposits(2, position, proof);
                // verify execution integrity
                await expect(tx).to.emit(rollup, "ConfirmDeposit").withArgs(
                    expected.oldRoot,
                    expected.newRoot,
                    4
                );
            })

        })
        describe('Batch #2', async () => {
            it('Deposit #4 (Charlie)', async () => {
                // check deposit fn execution logic
                const l2Pubkey = accounts.charlie.L2.pubkey.map(point => F.toObject(point));
                const tx = rollup.connect(accounts.charlie.L1).deposit(l2Pubkey, 500, 1, { value: 500 });
                await expect(tx).to.emit(rollup, 'RequestDeposit').withArgs(l2Pubkey, 500, 1);
                accounts.charlie.L2.credit(BigInt(500));
                // check deposit queue
                const expectedRoot = accounts.charlie.L2.root;
                const depositRoot = F.toObject((await rollup.describeDeposits())._leaves[0]);
                expect(expectedRoot).to.be.equal(depositRoot);
            })
            it('Deposit #5 (David)', async () => {
                // check deposit fn execution logic
                const l2Pubkey = accounts.david.L2.pubkey.map(point => F.toObject(point));
                const tx = rollup.connect(accounts.david.L1).deposit(l2Pubkey, 499, 1, { value: 499 });
                await expect(tx).to.emit(rollup, 'RequestDeposit').withArgs(l2Pubkey, 499, 1);
                accounts.david.L2.credit(BigInt(499));
                // check deposit queue
                const expectedRoot = F.toObject(poseidon[
                    accounts.charlie.L2.root,
                    accounts.david.L2.root
                ])
                const depositRoot = F.toObject((await rollup.describeDeposits())._leaves[0]);
                expect(expectedRoot).to.be.equal(depositRoot);
            })
            it('Process Batch #2 (2 new balance leaves)', async () => {
                // construct expected values
                const oldRoot = tree.root;
                tree.insert(accounts.charlie.L2.root);
                tree.insert(accounts.david.L2.root);
                const expected = { oldRoot, newRoot: tree.root }
                // construct transaction
                const position = [0, 1, 0];
                const proof = [zeroCache[1], subtree, zeroCache[3]];
                const tx = rollup.connect(accounts.coordinator.L1).processDeposits(1, position, proof);
                // verify execution integrity
                await expect(tx).to.emit(rollup, "ConfirmDeposit").withArgs(
                    expected.oldRoot,
                    expected.newRoot,
                    2
                );
            })
        })
    })
    describe('Transfers', async () => {
        let oldRoot, txTree, input;

        before(async () => {

            txs = [];
            txTree = new IncrementalMerkleTree(_poseidon, 2, BigInt(0));
            oldRoot = tree.root;
            input = {
                from: [], // array of sender eddsa keys
                to: [], // array of receiver eddsa keys
                amount: [], // array of L2 transaction values
                fromIndex: [], // array of sender index in balance tree
                fromNonce: [], // array of sender nonce for tx
                fromTokenType: [], // array of sender token types
                signature: [], // array of signatures by sender eddsa key on tx data
                fromBalance: [], // array of sender balances
                toNonce: [], // array of receiver nonce in bal tree
                toBalance: [],
                toTokenType: [],
                txPositions: [],
                txProof: [],
                fromPositions: [],
                fromProof: [],
                toPositions: [],
                toProof: [],
                txRoot: undefined,
                prevRoot: tree.root,
                nextRoot: undefined
            }

        });

        describe('Build a state rollup batch', async () => {
            it('Alice --{20}--> Bob', async () => {
                // compute inclusion proof & update sender in balance tree 
                const value = BigInt(20);
                const tokenType = 1;
                const fromIndex = 2;
                let { siblings: fromProof, pathIndices: fromPositions } = tree.createProof(fromIndex);
                fromProof = fromProof.map(node => node[0]);
                const fromBalance = accounts.alice.L2.balance;
                const fromNonce = accounts.alice.L2.nonce;
                accounts.alice.L2.debit(value);
                tree.update(fromIndex, accounts.alice.L2.root);
                
                // compute inclusion proof & update receiver in balance tree
                let { siblings: toProof, pathIndices: toPositions } = tree.createProof(3);
                toProof = toProof.map(node => node[0]);
                const toBalance = accounts.bob.L2.balance;
                accounts.bob.L2.credit(value);
                tree.update(3, accounts.bob.L2.root);
    
                // compute tx leaf
                const txData = [
                    ...accounts.alice.L2.getPubkey(),
                    fromIndex, // fromIndex
                    ...accounts.bob.L2.getPubkey(),
                    fromNonce, // nonce
                    value, // amount
                    tokenType // tokenType
                ];
                
                // compute tx in tx tree inclusion proof
                const leaf = poseidon(txData);
                const signature = accounts.alice.L2.sign(leaf);
                txTree.insert(F.toObject(leaf));
                
    
                // add data to input array
                input.from.push(accounts.alice.L2.getPubkey());
                input.to.push(accounts.bob.L2.getPubkey());
                input.amount.push(value);
                input.fromIndex.push(fromIndex);
                input.fromNonce.push(fromNonce);
                input.fromTokenType.push(tokenType);
                input.signature.push(signature);
                input.fromBalance.push(fromBalance);
                input.toNonce.push(accounts.bob.L2.nonce);
                input.toBalance.push(toBalance);
                input.toTokenType.push(tokenType);
                input.fromPositions.push(fromPositions);
                input.fromProof.push(fromProof);
                input.toPositions.push(toPositions);
                input.toProof.push(toProof);
            });
            it('Charlie --{400}--> Bob', async () => {
                // compute inclusion proof & update sender in balance tree 
                const value = BigInt(400);
                const tokenType = 1;
                const fromIndex = 4;
                let { siblings: fromProof, pathIndices: fromPositions } = tree.createProof(fromIndex);
                fromProof = fromProof.map(node => node[0]);
                const fromBalance = accounts.charlie.L2.balance;
                const fromNonce = accounts.charlie.L2.nonce;
                accounts.charlie.L2.debit(value);
                tree.update(fromIndex, accounts.charlie.L2.root);
                
                // compute inclusion proof & update receiver in balance tree
                let { siblings: toProof, pathIndices: toPositions } = tree.createProof(3);
                toProof = toProof.map(node => node[0]);
                const toBalance = accounts.bob.L2.balance;
                accounts.bob.L2.credit(value);
                tree.update(3, accounts.bob.L2.root);
    
                // compute tx leaf
                const txData = [
                    ...accounts.charlie.L2.getPubkey(),
                    fromIndex, // fromIndex
                    ...accounts.bob.L2.getPubkey(),
                    fromNonce, // nonce
                    value, // amount
                    tokenType // tokenType
                ];
                
                // compute tx in tx tree inclusion proof
                const leaf = poseidon(txData);
                const signature = accounts.charlie.L2.sign(leaf);
                txTree.insert(F.toObject(leaf));      
    
                // add data to input array
                input.from.push(accounts.charlie.L2.getPubkey());
                input.to.push(accounts.bob.L2.getPubkey());
                input.amount.push(value);
                input.fromIndex.push(fromIndex);
                input.fromNonce.push(fromNonce);
                input.fromTokenType.push(tokenType);
                input.signature.push(signature);
                input.fromBalance.push(fromBalance);
                input.toNonce.push(accounts.bob.L2.nonce);
                input.toBalance.push(toBalance);
                input.toTokenType.push(tokenType);
                input.fromPositions.push(fromPositions);
                input.fromProof.push(fromProof);
                input.toPositions.push(toPositions);
                input.toProof.push(toProof);
            })
            it('Bob --{33}--> David', async () => {
                // compute inclusion proof & update sender in balance tree 
                const value = BigInt(33);
                const tokenType = 1;
                const fromIndex = 3;
                let { siblings: fromProof, pathIndices: fromPositions } = tree.createProof(fromIndex);
                fromProof = fromProof.map(node => node[0]);
                const fromBalance = accounts.bob.L2.balance;
                const fromNonce = accounts.bob.L2.nonce;
                accounts.bob.L2.debit(value);
                tree.update(fromIndex, accounts.bob.L2.root);
                
                // compute inclusion proof & update receiver in balance tree
                let { siblings: toProof, pathIndices: toPositions } = tree.createProof(5);
                toProof = toProof.map(node => node[0]);
                const toBalance = accounts.david.L2.balance;
                accounts.david.L2.credit(value);
                tree.update(5, accounts.david.L2.root);
    
                // compute tx leaf
                const txData = [
                    ...accounts.bob.L2.getPubkey(),
                    fromIndex, // fromIndex
                    ...accounts.david.L2.getPubkey(),
                    fromNonce, // nonce
                    value, // amount
                    tokenType // tokenType
                ];
                
                // compute tx in tx tree inclusion proof
                const leaf = poseidon(txData);
                const signature = accounts.bob.L2.sign(leaf);
                txTree.insert(F.toObject(leaf));              
    
                // add data to input array
                input.from.push(accounts.bob.L2.getPubkey());
                input.to.push(accounts.david.L2.getPubkey());
                input.amount.push(value);
                input.fromIndex.push(fromIndex);
                input.fromNonce.push(fromNonce);
                input.fromTokenType.push(tokenType);
                input.signature.push(signature);
                input.fromBalance.push(fromBalance);
                input.toNonce.push(accounts.david.L2.nonce);
                input.toBalance.push(toBalance);
                input.toTokenType.push(tokenType);
                input.fromPositions.push(fromPositions);
                input.fromProof.push(fromProof);
                input.toPositions.push(toPositions);
                input.toProof.push(toProof);
            })
            it('Bob --{402}--> L1 (withdraw tx)', async () => {
                // compute inclusion proof & update sender in balance tree 
                const value = BigInt(402);
                const tokenType = 1;
                const fromIndex = 3;
                let { siblings: fromProof, pathIndices: fromPositions } = tree.createProof(fromIndex);
                fromProof = fromProof.map(node => node[0]);
                const fromBalance = accounts.bob.L2.balance;
                const fromNonce = accounts.bob.L2.nonce;
                accounts.bob.L2.debit(value);
                tree.update(fromIndex, accounts.bob.L2.root);
                
                // compute inclusion proof & update receiver in balance tree
                let { siblings: toProof, pathIndices: toPositions } = tree.createProof(0);
                toProof = toProof.map(node => node[0]);
                
                // compute tx leaf
                const txData = [
                    ...accounts.bob.L2.getPubkey(),
                    fromIndex, // fromIndex
                    ...[BigInt(0), BigInt(0)],
                    fromNonce, // nonce
                    value, // amount
                    tokenType // tokenType
                ];
                
                // compute tx in tx tree inclusion proof
                const leaf = poseidon(txData);
                const signature = accounts.bob.L2.sign(leaf);
                txTree.insert(F.toObject(leaf));     
    
                // add data to input array
                input.from.push(accounts.bob.L2.getPubkey());
                input.to.push([BigInt(0), BigInt(0)]);
                input.amount.push(value);
                input.fromIndex.push(fromIndex);
                input.fromNonce.push(fromNonce);
                input.fromTokenType.push(tokenType);
                input.signature.push(signature);
                input.fromBalance.push(fromBalance);
                input.toNonce.push(BigInt(0));
                input.toBalance.push(BigInt(0));
                input.toTokenType.push(BigInt(0)); // withdraw has toTokenType of 0
                input.fromPositions.push(fromPositions);
                input.fromProof.push(fromProof);
                input.toPositions.push(toPositions);
                input.toProof.push(toProof);

                // assign txRoot and nextRoot since final tx
                input.txRoot = txTree.root;
                input.nextRoot = tree.root;

                // assign all tx proofs
                for (let i = 0; i < 4; i++) {
                    let { siblings: txProof, pathIndices: txPositions } = txTree.createProof(i);
                    txProof = txProof.map(node => node[0]);
                    input.txPositions.push(txPositions);
                    input.txProof.push(txProof);
                }
            })
        });
        describe('Rollup layer 2 state to layer 1', async () => {
            it('Simulate constraints with circom_tester', async () => {
                const w = await stateCircuit.calculateWitness(input);
                await stateCircuit.assertOut(w, {});
            })
            it('Generate proof usable on-chain', async () => {
                let { proof } = await snarkjs.groth16.fullProve(
                    input,
                    'zk/update_state_verifier_js/update_state_verifier.wasm',
                    'zk/zkey/update_state_verifier_final.zkey'
                )
                const proofArgs = buildProofArgs(proof);
                const tx = rollup.updateState(proofArgs, txTree.root, tree.root);
                await expect(tx).to.emit(rollup, 'UpdatedState').withArgs(
                    tree.root,
                    oldRoot,
                    txTree.root
                );
            })
        });
    });
    describe('Withdraw from L2 to L1', async () => {
        it('Simulate withdraw with circom_tester', async () => {
            // sign pubkey
            const recipient = BigInt(accounts.bob.L1.address);
            const data = poseidon(BigInt(1), recipient); // L2 withdraw tx nonce, recipient
            const signature = accounts.bob.L2.sign(data);
            input = { pubkey: accounts.bob.L2.getPubkey(), signature };
            const w = await withdrawCircuit.calculateWitness(input);
            await withdrawCircuit.assertOut(w, {});
        })
        xit('Withdraw on-chain', async () => {
            let { proof } = await snarkjs.groth16.fullProve(
                input,
                'zk/withdraw_signature_verifier_js/withdraw_signature_verifier.wasm',
                'zk/zkey/withdraw_signature_verifier_final.zkey'
            )
            console.log('x', proof);
            const proofArgs = buildProofArgs(proof);

        })
    })
})

