//SPDX-License-Identifier: GNU GPLv3
pragma solidity ^0.8.15;

import "./IMiMC.sol";

/**
 * @title Interface for a merkle tree using the MiMC7 hash
 */
abstract contract IMiMCMerkle {

    /// VARIABLES ///

    IMiMC public mimc; // contract capable of performing MiMC hashes

    uint public IV = 15021630795539610737508582392395901278341266317943626182700664337106830745361; // honestly no clue yet

    // hashes for empty tree of depth 16
    uint[5] public zeroCache = [
        17400342990847699622034895903486521563192531922107760411846337521891653711537, //H0 = empty leaf
        6113825327972579408082802166670133747202624653742570870320185423954556080212,  //H1 = hash(H0, H0)
        6180012883826996691682233524035352980520561433337754209809143632670877151717,  //H2 = hash(H1, H1)
        20633846227573655562891472654875498275532732787736199734105126629336915134506, //...and so on
        19963324565646943143661364524780633879811696094118783241060299022396942068715
    ];

    /// FUNCTIONS ///

    /**
     * Still kinda figuring this one out tbh
     */
    function getRootFromProof(
        uint256 _leaf,
        uint256[] memory _position,
        uint256[] memory _proof
    ) public virtual view returns(uint);

    /**
     * Create a MiMC hash for a merkle leaf hash
     * @param _array - array of integer values to hash together
     *  - [pubkey_x, pubkey_y, balance, nonce, token_type]
     * @return - the MiMC7 hash of the data contained within _array
     */
    function hashMiMC(uint[] memory _array) public virtual view returns(uint);

}
