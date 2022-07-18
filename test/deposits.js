const { deployments, ethers } = require('hardhat')
const { solidity } = require("ethereum-waffle");
const { buildEddsa, buildPoseidon } = require('circomlibjs')
const chai = require("chai").use(solidity)
const { initializeContracts, generateAccounts, L2Account } = require('./utils')
const { IncrementalMerkleTree } = require('@zk-kit/incremental-merkle-tree');
const { expect } = require('chai');

describe("Test rollup deposits", async () => {
    let eddsa, poseidon, F;
    let signers, accounts;
    let rollup;
    before(async () => {

        // initial
        signers = await ethers.getSigners();
        poseidon = await buildPoseidon();
        eddsa = await buildEddsa();
        F = poseidon.F;

        // generate zero cache
        const depths = [4, 2];
        const zeroCache = [BigInt(0)];
        for (let i = 1; i < depths[0]; i++) {
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
                expect(expectedRoot).to.be.equal(depositRoot);
            })
            it('Process Deposit Batch #1', async () => {

            })
        })

    })
    xit('Make first 4 deposits', async () => {
        // 1st deposit (0 address)
        await (await rollup.deposit([0, 0], 0, 0, { from: accounts.coordinator.L1.address })).wait();
        const description = await rollup.describeDeposits();
        const q = F.toObject(poseidon([0, 0]));
        console.log('expected: ', F.toObject(L2Account.emptyRoot(poseidon)));
        // await (await rollup.deposit(
        //     accounts.coordinator.L2.getPubkey(),
        //     0,
        //     0,
        //     { from: accounts.coordinator.L1.address }
        // )).wait() // coordinator address

        // await (await rollup.deposit(
        //     accounts.alice.L2.getPubkey(),
        //     10, // num tokens in wei
        //     1, // ether
        //     { value: 10, from: accounts.alice.L1.signer }
        // )).wait()
        // accounts.alice.L2.credit(BigInt(10))
        // await (await rollup.deposit(
        //     accounts.bob.L2.getPubkey(),
        //     20, // num tokens in wei
        //     1, // ether
        //     { value: 20, from: accounts.bob.L1.signer }
        // )).wait()
        // accounts.bob.L2.credit(BigInt(20))
        // // get leaves
        // const leaves = [
        //     L2Account.emptyRoot(poseidon),
        //     accounts.coordinator.L2.root,
        //     accounts.alice.L2.root,
        //     accounts.bob.L2.root
        // ]
        // // ensure deposit tree correctly reflects onchain/ offchain
        // const description = await rollup.describeDeposits()
        // const height = description._heights[0].toNumber();
        // const root = description._leaves[0];
        // const tree = new IncrementalMerkleTree(
        //     poseidon,
        //     description._heights[0].toNumber(),
        //     BigInt(0),
        //     height
        // )
        // for (leaf of leaves) {
        //     tree.insert(leaf)
        // }
        // const expectedRoot = BigInt(`0x${Buffer.from(tree.root).toString('hex')}`)
        // console.log('expected root: ', expectedRoot)
        // console.log('on-chain root: ', BigInt(root.toString()))


    })
    it('this is a test', async () => {
        console.log('true')
    })
})


// const rollupFixture = deployments.createFixture(
//     async ({ deployments, ethers }, _) => {
//         console.log('q')
//         console.log('r')
//         // get circomlibjs objects
//         console.log('s')
//         console.log('a')
//         // generate zero cache
//         const depths = [4, 2];
//         const zeroCache = [BigInt(0)];
//         for (let i = 1; i < depths[0]; i++) {
//             const root = zeroCache[i - 1];
//             const internalNode = circomlibjs.poseidon([root, root])
//             zeroCache.push(BigInt(`0x${Buffer.from(internalNode).toString('hex')}`));
//         }
//         console.log('b')
//         // deploy poseidon contracts
//         const poseidonT3ABI = poseidonContract.generateABI(2);
//         const poseidonT3Bytecode = poseidonContract.createCode(2);
//         const poseidonT3Factory = new ethers.ContractFactory(poseidonT3ABI, poseidonT3Bytecode, operator);
//         const poseidonT3 = await poseidonT3Factory.deploy();
//         await poseidonT3.deployed();
//         const poseidonT6ABI = poseidonContract.generateABI(5);
//         const poseidonT6Bytecode = poseidonContract.createCode(5);
//         const poseidonT6Factory = new ethers.ContractFactory(poseidonT6ABI, poseidonT6Bytecode, operator);
//         const poseidonT6 = await poseidonT6Factory.deploy();
//         await poseidonT6.deployed();
//         // deploy verifiers
//         console.log('c')
//         const { address: usvAddress } = await deployments.deploy('UpdateStateVerifier', {
//             from: operator.address,
//             log: true
//         })
//         const { address: wsvAddress } = await deployments.deploy('WithdrawSignatureVerifier', {
//             from: operator.address,
//             log: true
//         })

//         // deploy token registry
//         const { address: registryAddress } = await deployments.deploy('TokenRegistry', {
//             from: operator.address,
//             log: true
//         })

//         // deploy rollup contract
//         const { address: rollupAddress } = await deployments.deploy('RollupNC', {
//             from: operator.address,
//             args: [
//                 [usvAddress, wsvAddress, registryAddress],
//                 depths,
//                 0,
//                 zeroCache
//             ],
//             libraries: {
//                 PoseidonT3: poseidonT3.address,
//                 PoseidonT6: poseidonT6.address
//             }
//         })
//         return {
//             poseidon,
//             eddsa,
//             rollupAddress,
//             registryAddress
//         }
//     }
// )