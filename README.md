This repository updates [RollupNC](https://github.com/rollupnc/RollupNC) for 2022. Changes include:
  * Circom 2.x, updated SnarkJS
    * includes changes to Circom code based on breaking syntax changes
  * Use of @zk-kit/incremental-merkle-tree to create account/ transaction trees
  * Cleaner test file
  * Switched from MiMC to Poseidon hash (on chain, in circuits)
    * this might have actually caused worse performance given we couldn't hash 8 inputs (hash 4 + hash 4, then hash 2) for transaction leaves
  * Changed variables to be more intuitive
    * tbh need to change them again so they are standardized to @zk-kit/incremental-merkle-tree naming
  * removed intermediate root public input (not necessary)
[The test file](https://github.com/jp4g/zkrollup-demo/blob/master/test/0.js) is the main value add in this repository!

Visit [RollupNC](https://github.com/rollupnc/RollupNC) for docs - some naming is different but fundamentally this rollup works the exact same as RollupNC
Visit [the BattleZips](https://discord.gg/NEyTSmjewn) discord for help with this repository
