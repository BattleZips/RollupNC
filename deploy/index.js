require('dotenv').config();
const fs = require('fs');
const { poseidonContract, buildPoseidonOpt } = require('circomlibjs')
const { ethers } = require('hardhat');

/**
 * Deploy All Contracts
 */
module.exports = async ({ run, ethers, network, deployments }) => {

    // get zero cache
    const depths = [4, 2];
    const poseidon = await buildPoseidonOpt();
    const zeroCache = [BigInt(0)];
    for (let i = 1; i < depths[0]; i++) {
        const root = zeroCache[i - 1];
        zeroCache.push(BigInt(`0x${Buffer.from(poseidon([root, root])).toString('hex')}`));
    }
    // get deploying account
    const [operator, alice, bob, charlie, david, emily] = await ethers.getSigners();

    // deploy hash constructs for 2 and 5 inputs
    const poseidonT3ABI = poseidonContract.generateABI(2);
    const poseidonT3Bytecode = poseidonContract.createCode(2);
    const poseidonT3Factory = new ethers.ContractFactory(poseidonT3ABI, poseidonT3Bytecode, operator);
    const poseidonT3 = await poseidonT3Factory.deploy();
    await poseidonT3.deployed();
    const poseidonT6ABI = poseidonContract.generateABI(5);
    const poseidonT6Bytecode = poseidonContract.createCode(5);
    const poseidonT6Factory = new ethers.ContractFactory(poseidonT6ABI, poseidonT6Bytecode, operator);
    const poseidonT6 = await poseidonT6Factory.deploy();
    await poseidonT6.deployed();

    // deploy verifiers
    const { address: usvAddress } = await deployments.deploy('UpdateStateVerifier', {
        from: operator.address,
        log: true
    })
    const { address: wsvAddress } = await deployments.deploy('WithdrawSignatureVerifier', {
        from: operator.address,
        log: true
    })

    // deploy token registry
    const { address: registryAddress } = await deployments.deploy('TokenRegistry', {
        from: operator.address,
        log: true
    })
    
    // deploy rollup contract
    const { address: rollupAddress } = await deployments.deploy('RollupNC', {
        from: operator.address,
        args: [
            [usvAddress, wsvAddress, registryAddress],
            depths,
            0,
            zeroCache
        ],
        libraries: {
            PoseidonT3: poseidonT3.address,
            PoseidonT6: poseidonT6.address
        }
    })
    console.log('Deployed Rollup to ', rollupAddress)
}

/**
 * Determine if err message can be ignored
 * @param {string} err - the error text returned from etherscan verification
 * @return true if bytecode is verified, false otherwise 
 */
const alreadyVerified = (err) => {
    return err.includes('Reason: Already Verified')
        || err.includes('Contract source code already verified')
}

/**
 * Deploy circuit files to IPFS and log their CID's to terminal
 * @dev includes return of cids but is not used
 */
const ipfsDeploy = async () => {
    // get files generated from `yarn setup` as buffers
    const files = [
        {
            verification_key: Buffer.from(fs.readFileSync('zk/board_verification_key.json')),
            zkey: Buffer.from(fs.readFileSync('zk/zkey/board_final.zkey')),
            circuit: Buffer.from(fs.readFileSync('zk/board_js/board.wasm'))
        },
        {
            verification_key: Buffer.from(fs.readFileSync('zk/shot_verification_key.json')),
            zkey: Buffer.from(fs.readFileSync('zk/zkey/shot_final.zkey')),
            circuit: Buffer.from(fs.readFileSync('zk/shot_js/shot.wasm'))
        }
    ]
    // deploy files to ipfs and log CID paths
    const ipfs = ipfsApi('ipfs.infura.io', '5001', { protocol: 'https' })
    const labels = ['Board', 'Hash']
    console.log(`\nPublishing circuit files to IPFS`)
    console.log('=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=')
    for (let i = 0; i < files.length; i++) {
        const cids = {
            verification_key: (await ipfs.files.add(files[i].verification_key))[0].path,
            zkey: (await ipfs.files.add(files[i].zkey))[0].path,
            circuit: (await ipfs.files.add(files[i].circuit))[0].path
        }
        console.log(`\n${labels[i]} verification key CID: ${cids.verification_key}`)
        console.log(`${labels[i]} zkey CID: ${cids.zkey}`)
        console.log(`${labels[i]} circuit wasm CID: ${cids.circuit}`)
    }
}

/**
 * Verify contract on Etherscan or Polygonscan block explorers if possible
 * @notice requires ETHERSCAN and POLYGONSCAN in .env defined for block explorer api access
 * @notice I have had bad luck with rinkeby, goerli and polygonscan will for sure work
 * 
 * @param {string} bvAddress - the address of the deployed board verifier contract
 * @param {string} svAddress - the address of the deployed shot verifier contract
 * @param {string} forwarder - the address of the game contract's minimal trusted forwarder
 * @param {string} gameAddress - the address of the deployed BattleshipGame contract
 */
const verifyEtherscan = async (bvAddress, svAddress, forwarder, gameAddress) => {
    // check if supported network
    const chainId = ethers.provider._network.chainId
    const chains = [[1, 4, 5, 42], [137, 80001]]
    if (!chains.flat().includes(chainId) && !chains.flat().includes(chainId)) {
        console.log('Skipping block explorer verification for unsupported network')
        return
    }
    // check if env is configured correctly
    const { POLYGONSCAN, ETHERSCAN } = process.env
    if (chains[0].includes(chainId) && !ETHERSCAN) {
        console.log(`Etherscan API key not found, skipping verification on chain ${chainId}`)
        return
    } else if (chains[1].includes(chainId) && !POLYGONSCAN) {
        console.log(`Polygonscan API key not found, skipping verification on chain ${chainId}`)
        return
    }
    // error message
    const WAIT_ERR = "Wait 30 seconds for tx to propogate and rerun"
    try {
        await run('verify:verify', { address: bvAddress })
    } catch (e) {
        if (!alreadyVerified(e.toString())) throw new Error(WAIT_ERR)
        else console.log('=-=-=-=-=\nBoardVerifier.sol already verified\n=-=-=-=-=')
    }
    try {
        await run('verify:verify', { address: svAddress })
    } catch (e) {
        if (!alreadyVerified(e.toString())) throw new Error(WAIT_ERR)
        else console.log('=-=-=-=-=\nShotVerifier.sol already verified\n=-=-=-=-=')
    }
    try {
        await run('verify:verify', {
            address: gameAddress,
            constructorArguments: [forwarder, bvAddress, svAddress]
        })
    } catch (e) {
        if (!alreadyVerified(e.toString())) throw new Error(WAIT_ERR)
        else console.log('=-=-=-=-=\nBattleshipGame.sol already verified\n=-=-=-=-=')
    }
}