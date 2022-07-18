const { deployments, ethers } = require('hardhat')
const { solidity } = require("ethereum-waffle");
const { buildEddsa, buildPoseidon } = require('circomlibjs')
const chai = require("chai").use(solidity)
const { initializeContracts, generateAccounts, L2Account } = require('./utils')
const { IncrementalMerkleTree } = require('@zk-kit/incremental-merkle-tree');
const { expect } = require('chai');

describe("Test rollup deposits", async () => {
    let eddsa, poseidon, F; // circomlibjs objects
    let signers, accounts; // ecdsa/ eddsa wallets
    let rollup; // on-chain contract
    let zeroCache; // cache balance tree zeros
    let tree, subtree; // persist outside single unit test scope

    before(async () => {

        // initial
        signers = await ethers.getSigners();
        poseidon = await buildPoseidon();
        eddsa = await buildEddsa();
        F = poseidon.F;

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
                const coordinatorLeaf = F.toObject(poseidon([...coordinatorPubkey, 0, 0, 0]));
                const sibling = F.toObject(poseidon([L2Account.emptyRoot(poseidon), coordinatorLeaf]))
                const current = F.toObject(poseidon([accounts.alice.L2.root, accounts.bob.L2.root]));
                const expectedRoot = F.toObject(poseidon([sibling, current]));
                const depositRoot = F.toObject((await rollup.describeDeposits())._leaves[0]);
                subtree = depositRoot;
                expect(expectedRoot).to.be.equal(depositRoot);
            })
            it('Process Batch #1 (4 new balance leaves)', async () => {
                // construct expected values
                const emptyLeaf = L2Account.emptyRoot(poseidon)
                const coordinatorPubkey = accounts.coordinator.L2.pubkey.map(point => F.toObject(point));
                const coordinatorLeaf = F.toObject(poseidon([...coordinatorPubkey, 0, 0, 0]));
                tree = new IncrementalMerkleTree(poseidon, 4, 0);
                tree.insert(emptyLeaf);
                tree.insert(coordinatorLeaf);
                tree.insert(accounts.alice.L2.root);
                tree.insert(accounts.bob.L2.root);
                const expected = {
                    oldRoot: zeroCache[zeroCache.length - 1],
                    newRoot: F.toObject(tree.root)
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
                const tx = rollup.connect(accounts.david.L1).deposit(l2Pubkey, 499, 1, { value: 500 });
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
                const oldRoot = F.toObject(tree.root);
                tree.insert(accounts.charlie.L2.root);
                tree.insert(accounts.david.L2.root);
                const expected = { oldRoot, newRoot: F.toObject(tree.root) }
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
})