const { ethers } = require('hardhat')
const { poseidonContract } = require('circomlibjs')
const L2Account = require('./accounts');
const crypto = require('crypto')

/**
 * Fresh deploy of rollup evm environment
 * @todo use hardhat testing fixtures
 * @param zeroCache - array of hashes for merkle tree heights w/ empty tree
 * @return the ethers contract object for the deployed rollup
 */
async function initializeContracts(zeroCache) {
    const signers = await ethers.getSigners()
    // deploy poseidon contracts
    const poseidonT3ABI = poseidonContract.generateABI(2);
    const poseidonT3Bytecode = poseidonContract.createCode(2);
    const poseidonT3Factory = new ethers.ContractFactory(poseidonT3ABI, poseidonT3Bytecode, signers[0]);
    const poseidonT3 = await poseidonT3Factory.deploy();
    await poseidonT3.deployed();
    const poseidonT6ABI = poseidonContract.generateABI(5);
    const poseidonT6Bytecode = poseidonContract.createCode(5);
    const poseidonT6Factory = new ethers.ContractFactory(poseidonT6ABI, poseidonT6Bytecode, signers[0]);
    const poseidonT6 = await poseidonT6Factory.deploy();
    await poseidonT6.deployed();
    // deploy verifiers
    const usvFactory = await ethers.getContractFactory('UpdateStateVerifier')
    const usv = await usvFactory.deploy()
    await usv.deployed()
    const wsvFactory = await ethers.getContractFactory('WithdrawSignatureVerifier')
    const wsv = await wsvFactory.deploy()
    await wsv.deployed()
    // deploy token registry
    const tokenRegistryFactory = await ethers.getContractFactory('TokenRegistry')
    const tokenRegistry = await tokenRegistryFactory.deploy()
    await tokenRegistry.deployed()
    // deploy rollup contract
    const rollupFactory = await ethers.getContractFactory('RollupNC', {
        libraries: {
            PoseidonT3: poseidonT3.address,
            PoseidonT6: poseidonT6.address
        }
    })
    const depths = [4, 2];
    const rollupDeployArgs = [
        [usv.address, wsv.address, tokenRegistry.address],
        depths,
        0,
        zeroCache
    ]
    const rollup = await rollupFactory.deploy(...rollupDeployArgs)
    await rollup.deployed()
    // link registry and rollup
    await tokenRegistry.setRollup(rollup.address, { from: signers[0].address })
    return rollup;
}

/**
 * Generate L2 accounts and associate them with L1 signers by name
 * @param poseidon - instantiated circomlibjs poseidon object
 * @param eddsa - instantiated circomlibjs eddsa object
 * @return dictionary of human-readable account names to L1/L2 signing objects
 */
async function generateAccounts(poseidon, eddsa) {
    const signers = await ethers.getSigners()
    return ['coordinator', 'alice', 'bob', 'charlie', 'david', 'emily', 'frank']
        .map((account, index) => {
            // make new L2 account
            return {
                name: account,
                L1: signers[index],
                L2: L2Account.genAccount(poseidon, eddsa)
            }
        }).reduce((obj, entry) => {
            obj[entry.name] = {
                L1: entry.L1,
                L2: entry.L2
            }
            return obj;
        }, {});
}

module.exports = {
    initializeContracts,
    generateAccounts,
    L2Account
}