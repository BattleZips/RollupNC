const { task, types } = require("hardhat/config")
const bigInt = require('big-integer')
const { buildPoseidonOpt } = require('circomlibjs')
const { writeFileSync } = require('fs');
const path = require('path');

task('zeroCache', 'Generate a zero cache for a merkle tree')
    .addOptionalParam('depth', 'The depth of the tree/ # of roots to cache (2 <= depth <= 32', 4, types.int)
    .addOptionalParam('zero', 'The value to use as zero (valid uint on F_p)', 0, types.int)
    .setAction(async ({ depth, zero }) => {
        // check depth range
        if (depth && !(depth >= 2 && depth <= 32))
            throw new Error(`Zero Cache: depth failed '2 <= ${depth} <= 32'`)

        // variables
        const _zero = BigInt(zero);
        const poseidon = await buildPoseidonOpt();
        const cache = [_zero];

        // create cache
        for (let i = 1; i < depth; i++) {
            const root = cache[i - 1];
            cache.push(BigInt(`0x${Buffer.from(poseidon([root, root])).toString('hex')}`));
        }

        // save to disk
        const _path = path.join(__dirname, '../src/', 'zeroCache.json');
        writeFileSync(_path, JSON.stringify(cache.map(entry => entry.toString())));
        console.log(`Wrote zero cache of depth '${depth}' to ${_path}`, cache);
    })