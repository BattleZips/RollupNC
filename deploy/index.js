require('dotenv').config()
const { ethers } = require('hardhat');
const fs = require('fs')


/**
 * Deploy All Contracts
 */
module.exports = async ({ run, ethers, network, deployments }) => {

    // get deploying account
    const [operator] = await ethers.getSigners();

    // deploy verifiers
    const { address: usvAddress } = await deployments.deploy('UpdateStateVerifier', {
        from: operator.address,
        log: true
    })
    const { address: wsvAddress } = await deployments.deploy('WithdrawSignatureVerifier', {
        from: operator.address,
        log: true
    })


    // // select forwarder
    // const chainId = ethers.provider._network.chainId
    // const forwarder = Forwarders[chainId] ? Forwarders[chainId] : ethers.constants.AddressZero

    // // deploy Battleship Game Contract / Victory token
    // const { address: gameAddress } = await deployments.deploy('BattleshipGame', {
    //     from: operator.address,
    //     args: [forwarder, bvAddress, svAddress],
    //     log: true
    // })

    // // verify deployed contracts
    // const delay = ms => new Promise(res => setTimeout(res, ms));
    // await delay(3000)
    // console.log("30 second wait for deploy TX's to propogate to block explorer before verification")
    // await verifyEtherscan(bvAddress, svAddress, forwarder, gameAddress)

    // // add to biconomy
    // // will skip biconomy enrollment if forwarder address is 0 or biconomy api not provided
    // // will skip if not a supported network
    // // biconomy api will change depending on network and must manually be updated in .env :(
    // const { BICONOMY_AUTH, BICONOMY_API } = process.env
    // if (BICONOMY_API === undefined || BICONOMY_AUTH == undefined)
    //     console.log('Biconomy API keys not provided, skipping')
    // else if (!Object.keys(Forwarders).includes(chainId.toString()))
    //     console.log('Skipping Biconomy integration for unsupported network')
    // else {
    //     try {
    //         await addContract(gameAddress)
    //         console.log(`Biconomy configured for BattleshipGame.sol on chain ${chainId}`)
    //     } catch (err) {
    //         throw new Error("Failed to add contract & methods to Biconomy", err)
    //     }
        
    // }
    // // add circuit files to ipfs if not hardhat
    // if (chainId !== 31337) await ipfsDeploy()
    // else console.log('Skipping IPFS circuit publication for hardhat network')

    // // complete
    console.log(`RollupNC V2 Deployment Completed Successfully on chain ${ethers.provider._network.chainId}`)
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