const { buildEddsa, buildMimc7 } = require('circomlibjs');
const { randomBytes } = require('crypto');
const { read } = require('fs');
const RollupAccount = require('./rollupAccount');
const RollupTransaction = require('./rollupTransaction');

async function main() {
    const { mimc7, eddsa } = await initCrypto();
    const priv = randomBytes(32);
    const pub = eddsa.prv2pub(priv);
    const readablePub = Buffer.from(pub[0]).toString('hex') + Buffer.from(pub[1]).toString('hex');
    console.log('q', readablePub)
    const emptyAccount = RollupAccount.getEmptyAccount(mimc7);
    console.log(emptyAccount);
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