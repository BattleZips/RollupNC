const { buildEddsa, buildMimc7 } = require('circomlibjs');
const { randomBytes } = require('crypto');
const bigInt = require('big-integer')
const RollupAccount = require('./rollupAccount');
const RollupTransaction = require('./rollupTransaction');

async function main() {
    // get crypto libraries
    const { mimc7, eddsa } = await initCrypto();
    // create test accounts
    const accounts = [randomBytes(32), randomBytes(32)].map((prv) => { return { prv, pub: eddsa.prv2pub(prv) } });
    // try a real dummy tx
    const realTx = new RollupTransaction(mimc7, eddsa, accounts[0].pub, 0, accounts[1].pub, 0, 1000000, 0);
    realTx.sign(accounts[0].prv);
    console.log(`Real tx integrity status: ${realTx.verify()}`);
    // try a fake dummy tx
    const fakeTx = new RollupTransaction(mimc7, eddsa, accounts[0].pub, 0, accounts[1].pub, 0, 1000000, 0);
    fakeTx.sign(accounts[1].prv);
    console.log(`Fake tx integrity status: ${fakeTx.verify()}`);
    
}

async function initCrypto() {
    const mimc7 = await buildMimc7();
    const eddsa = await buildEddsa();
    return { mimc7, eddsa };
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });