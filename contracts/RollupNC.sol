//SPDX-License-Identifier: GNU GPLv3
pragma solidity ^0.8.15;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
// import './interfaces/IRollup.sol';
import "./interfaces/ITokenRegistry.sol";
import "./interfaces/IVerifier.sol";
// import "./libraries/PackedPairings.sol";
import "./libraries/Poseidon.sol";
import "hardhat/console.sol";

/// @title implementation of Non-custodial rollup
contract RollupNC {
    IVerifier public usv; // update state verifier
    IVerifier public wsv; // withdraw signature verifier
    // IncrementalBinaryTree public state; // incremental binary tree of account balances
    mapping(uint256 => uint256) public pendingDeposits;
    ITokenRegistry public registry;

    uint256 public balDepth;
    uint256 public txDepth;
    uint256 public ZERO;
    uint256[] public zeroCache;

    uint256 public currentRoot;
    address public coordinator;
    uint256 public depositQueueStart;
    uint256 public depositQueueEnd;
    uint8 public depositQueueSize;
    uint8 public depositSubtreeHeight;
    uint256 public updateNumber;

    // (queueNumber => [pubkey_x, pubkey_y, balance, nonce, token_type])
    mapping(uint256 => uint256) public deposits; //leaf idx => leafHash
    mapping(uint256 => uint256) public updates; //txRoot => update idx

    event RegisteredToken(uint256 tokenType, address tokenContract);
    event RequestDeposit(uint256[2] pubkey, uint256 amount, uint256 tokenType);
    event UpdatedState(uint256 currentRoot, uint256 oldRoot, uint256 txRoot);
    event Withdraw(uint256[9] accountInfo, address recipient);

    modifier onlyCoordinator() {
        assert(msg.sender == coordinator);
        _;
    }

    /// @dev construct a new non-custodial on-chain rollup
    /// @param _addresses: array of addresses used in the rollup contract
    ///   [0]: Update State Verifier contract
    ///   [1]: Withdrawal Signature Verifier contract
    ///   [2]: Rollup token registry contract
    /// @param _depth: depth of trees
    ///   [0]: Balance tree max depth
    ///   [1]: Tx tree max depth
    /// @param _zero: the value to use for an empty leaf in a merkle tree
    /// @param _zeroCache: array of precomputed roots for zero's at different heights
    constructor(
        address[3] memory _addresses,
        uint256[2] memory _depth,
        uint256 _zero,
        uint256[] memory _zeroCache
    ) {
        require(_depth[0] == _zeroCache.length, "Param size mismatch");
        // assign contract references
        usv = IVerifier(_addresses[0]);
        wsv = IVerifier(_addresses[1]);
        registry = ITokenRegistry(_addresses[2]);

        // assign primative variables
        balDepth = _depth[0];
        txDepth = _depth[1];
        ZERO = _zero;
        zeroCache = _zeroCache;
        currentRoot = zeroCache[balDepth - 1];
        coordinator = msg.sender;
    }

    // function updateState(
    //     uint256[2] memory a,
    //     uint256[2][2] memory b,
    //     uint256[2] memory c,
    //     uint256[3] memory input
    // ) public onlyCoordinator {
    //     require(currentRoot == input[2], "input does not match current root");
    //     //validate proof
    //     require(update_verifyProof(a, b, c, input), "SNARK proof is invalid");
    //     // update merkle root
    //     currentRoot = input[0];
    //     updateNumber++;
    //     updates[input[1]] = updateNumber;
    //     emit UpdatedState(input[0], input[1], input[2]); //newRoot, txRoot, oldRoot
    // }

    // user tries to deposit ERC20 tokens
    function deposit(
        uint256[2] memory pubkey,
        uint256 amount,
        uint256 tokenType
    ) public payable {
        // Ensure token can be transferred
        checkToken(amount, tokenType);
        // Store deposit leaf
        uint256 depositHash = PoseidonT6.poseidon(
            [pubkey[0], pubkey[1], amount, uint256(0), tokenType]
        );

        pendingDeposits[depositQueueEnd] = depositHash;
        depositQueueEnd++;
        depositQueueSize++;
        // Generate
        uint8 tmpDepositSubtreeHeight = 0;
        uint256 tmp = depositQueueSize;
        while (tmp % 2 == 0) {
            // while leafs can be hashed into merkle tree, generate a higher order internal node
            pendingDeposits[depositQueueEnd - 2] = PoseidonT3.poseidon(
                [
                    pendingDeposits[depositQueueEnd - 2],
                    pendingDeposits[depositQueueEnd - 1]
                ]
            );
            removeDeposit(false);
            tmp = tmp / 2;
            tmpDepositSubtreeHeight++;
        }
        if (tmpDepositSubtreeHeight > depositSubtreeHeight) {
            depositSubtreeHeight = tmpDepositSubtreeHeight;
        }
        emit RequestDeposit(pubkey, amount, tokenType);
    }

    // // coordinator adds certain number of deposits to balance tree
    // // coordinator must specify subtree index in the tree since the deposits
    // // are being inserted at a nonzero height
    function processDeposits(
        uint256 subtreeDepth,
        uint256[] memory subtreePosition,
        uint256[] memory subtreeProof
    ) public onlyCoordinator returns (uint256) {
        // ensure subtree specified is empty
        uint256 emptyRoot = zeroCache[subtreeDepth];
        require(
            currentRoot ==
                getRootFromProof(emptyRoot, subtreePosition, subtreeProof),
            "specified subtree is not empty"
        );
        // insert multiple leafs (insert subtree) by computing new root
        currentRoot = getRootFromProof(
            pendingDeposits[depositQueueStart],
            subtreePosition,
            subtreeProof
        );
        removeDeposit(true);
        depositQueueSize -= uint8(2**depositSubtreeHeight);
        return currentRoot;
    }

    // function withdraw(
    //     uint256[9] memory txInfo, //[pubkeyX, pubkeyY, index, toX ,toY, nonce, amount, token_type_from, txRoot]
    //     uint256[] memory position,
    //     uint256[] memory proof,
    //     address payable recipient,
    //     uint256[2] memory a,
    //     uint256[2][2] memory b,
    //     uint256[2] memory c
    // ) public {
    //     require(txInfo[7] > 0, "invalid tokenType");
    //     require(updates[txInfo[8]] > 0, "txRoot does not exist");
    //     uint256[] memory txArray = new uint256[](8);
    //     for (uint256 i = 0; i < 8; i++) {
    //         txArray[i] = txInfo[i];
    //     }
    //     uint256 txLeaf = mimcMerkle.hashMiMC(txArray);
    //     require(
    //         txInfo[8] == mimcMerkle.getRootFromProof(txLeaf, position, proof),
    //         "transaction does not exist in specified transactions root"
    //     );

    //     // message is hash of nonce and recipient address
    //     uint256[] memory msgArray = new uint256[](2);
    //     msgArray[0] = txInfo[5];
    //     msgArray[1] = uint256(recipient);

    //     require(
    //         withdraw_verifyProof(
    //             a,
    //             b,
    //             c,
    //             [txInfo[0], txInfo[1], mimcMerkle.hashMiMC(msgArray)]
    //         ),
    //         "eddsa signature is not valid"
    //     );

    //     // transfer token on tokenContract
    //     if (txInfo[7] == 1) {
    //         // ETH
    //         recipient.transfer(txInfo[6]);
    //     } else {
    //         // ERC20
    //         address tokenContractAddress = tokenRegistry.registeredTokens(
    //             txInfo[7]
    //         );
    //         tokenContract = IERC20(tokenContractAddress);
    //         require(
    //             tokenContract.transfer(recipient, txInfo[6]),
    //             "transfer failed"
    //         );
    //     }

    //     emit Withdraw(txInfo, recipient);
    // }

    //call methods on TokenRegistry contract

    function registerToken(address _token) public {
        registry.registerToken(_token);
    }

    function approveToken(address _token) public onlyCoordinator {
        registry.approveToken(_token);
        emit RegisteredToken(registry.registryIndex(), _token);
    }

    /// INTERNAL FUNCTIONS ///

    /**
     * Ensures a token can be deposited by the message sender
     * @dev throws error if checks are failed
     * @param _amount - the amount of tokens attempting to transfer
     * @param _type - the token's registry index
     */
    function checkToken(uint256 _amount, uint256 _type) internal {
        if (_type == 0) {
            require(
                msg.sender == coordinator,
                "tokenType 0 is reserved for coordinator"
            );
            require(
                _amount == 0 && msg.value == 0,
                "tokenType 0 does not have real value"
            );
        } else if (_type == 1) {
            require(
                msg.value > 0 && msg.value >= _amount,
                "msg.value must at least equal stated amount in wei"
            );
        } else if (_type > 1) {
            require(_amount > 0, "token deposit must be greater than 0");
            address tokenAddress = registry.registry(_type);
            require(
                IERC20(tokenAddress).transferFrom(
                    msg.sender,
                    address(this),
                    _amount
                ),
                "token transfer not approved"
            );
        }
    }

    /**
     * Remove a deposit in either a FIFO or LIFO manner
     * @param _fifo - if true, remove the oldest element (tallest subtree). else remove the newest element
     */
    function removeDeposit(bool _fifo) internal {
        if (_fifo) {
            // remove tallest perfect subtree
            delete pendingDeposits[depositQueueStart];
            depositQueueStart += 1;
        } else {
            // remove last inserted entry
            delete pendingDeposits[depositQueueEnd - 1];
            depositQueueEnd -= 1;
        }
    }

    /**
     * Describe the subtrees for balance tree build in deposit queue
     *
     * @return _leaves - the node value
     * @return _heights - the node height in the tree
     */
    function describeDeposits()
        public
        view
        returns (uint256[] memory _leaves, uint256[] memory _heights)
    {
        // create return variables
        uint256 num = depositQueueEnd - depositQueueStart; // number of entries in deposit queue
        _leaves = new uint256[](num);
        _heights = new uint256[](num);
        // compute height
        uint8 _i = 0; // track insert index, should always be safe
        for (uint256 i = 1; i <= depositSubtreeHeight; i++) {
            if ((depositQueueSize & (uint256(1) << i)) > 0)
                _heights[_i++] = i;
        }
        // store leaves
        for (uint256 i = 0; i < num; i++)
            _leaves[i] = pendingDeposits[depositQueueStart + i];
    }

    /**
     * Generate a merkle root from a given proof
     * @notice uses poseidon hash function
     * @dev does not prove membership - returned root must be compared to stored state
     *
     * @param _leaf - the item being checked for membership
     * @param _position - the path of the leaf in the tree
     * @param _proof - the sibling nodes at any given height in the tree
     */
    function getRootFromProof(
        uint256 _leaf,
        uint256[] memory _position,
        uint256[] memory _proof
    ) public pure returns (uint256) {
        uint256 hash = _leaf;
        for (uint8 i = 0; i < _proof.length; i++) {
            if (_position[i] == 0)
                hash = PoseidonT3.poseidon([hash, _proof[i]]);
            else hash = PoseidonT3.poseidon([_proof[i], hash]);
        }
        return hash;
    }
}
