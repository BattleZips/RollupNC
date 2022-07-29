//SPDX-License-Identifier: GNU GPLv3
pragma solidity ^0.8.15;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
// import './interfaces/IRollup.sol';
import "./interfaces/ITokenRegistry.sol";
import "./interfaces/IVerifier.sol";
// import { UnpackedProof, PackedProofs } from "./libraries/PackedProofs.sol";
import "./libraries/Poseidon.sol";
import "hardhat/console.sol";

/// @title implementation of Non-custodial rollup
contract RollupNC {

    IUSV public usv; // update state verifier
    IWSV public wsv; // withdraw signature verifier
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
    mapping(uint256 => bool) public withdraws; // txLeaf => true if withdrawn

    event RegisteredToken(uint256 tokenType, address tokenContract);
    event RequestDeposit(uint256[2] pubkey, uint256 amount, uint256 tokenType);
    event ConfirmDeposit(uint256 oldRoot, uint256 newRoot, uint8 numAdded);
    event UpdatedState(uint256 currentRoot, uint256 oldRoot, uint256 txRoot);
    event Withdrawn(uint256[8] accountInfo, address recipient);

    modifier onlyCoordinator() {
        require(msg.sender == coordinator);
        _;
    }

    modifier txTreeExists(uint256 _root) {
        require(updates[_root] > 0, "Tx root does not exist");
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
        require(_depth[0] + 1 == _zeroCache.length, "Param size mismatch");
        // assign contract references
        usv = IUSV(_addresses[0]);
        wsv = IWSV(_addresses[1]);
        registry = ITokenRegistry(_addresses[2]);

        // assign primative variables
        balDepth = _depth[0];
        txDepth = _depth[1];
        ZERO = _zero;
        zeroCache = _zeroCache;
        currentRoot = zeroCache[balDepth];
        coordinator = msg.sender;
    }

    /**
     * Commit a batch of L2 transactions to L1 state by proving correctness
     *
     * @param _proof - packed representation of zero knowledge proof of valid state change
     * @param _txRoot - merkle root storing the transactions mutating currentRoot to _nextRoot
     * @param _nextRoot - the balance tree root after applying _txRoot
     */
    function updateState(
        uint256[8] memory _proof,
        uint256 _txRoot,
        uint256 _nextRoot
    ) public onlyCoordinator {
        // validate state change via zk proof
        uint256[2] memory a = [_proof[0], _proof[1]];
        uint256[2] memory b_0 = [_proof[2], _proof[3]];
        uint256[2] memory b_1 = [_proof[4], _proof[5]];
        uint256[2] memory c = [_proof[6], _proof[7]];
        uint256[3] memory input = [_txRoot, currentRoot, _nextRoot];
        require(usv.verifyProof(a, [b_0, b_1], c, input), "SNARK proof is invalid");
        // update merkle root
        uint256 prev = currentRoot;
        currentRoot = _nextRoot;
        updateNumber++;
        updates[_txRoot] = updateNumber;
        emit UpdatedState(currentRoot, prev, _txRoot); //newRoot, txRoot, oldRoot
    }

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
        uint256 oldRoot = currentRoot;
        currentRoot = getRootFromProof(
            pendingDeposits[depositQueueStart],
            subtreePosition,
            subtreeProof
        );
        removeDeposit(true);
        uint8 numAdded = uint8(2**depositSubtreeHeight);
        depositQueueSize -= numAdded;
        // set deposit subtree height
        depositSubtreeHeight = 0;
        uint256 tmp = depositQueueSize;
        while(tmp / 2 > 0) {
            depositSubtreeHeight += 1;
            tmp = tmp / 2;
        }
        emit ConfirmDeposit(oldRoot, currentRoot, numAdded);
        return currentRoot;
    }

    /**
     * Withdraw a 
     */
    function withdraw(
        uint256[8] memory _tx, //[fromX, fromY, fromIndex, toX ,toY, nonce, amount, token_type_from, txRoot]
        uint256 _txRoot,
        uint256[] memory _txPosition,
        uint256[] memory _txProof,
        address payable _recipient,
        uint256[8] memory _proof
    ) public txTreeExists(_txRoot) {
        require(_tx[7] > 0, "invalid tokenType");
        uint256 leaf = PoseidonT9.poseidon(_tx);
        require(!withdraws[leaf], "Tx already withdrawn");
        require(
            _txRoot == getRootFromProof(leaf, _txPosition, _txProof),
            "tx does not exist in given transaction tree"
        );
        // validate state change via zk proof
        uint256[2] memory a = [_proof[0], _proof[1]];
        uint256[2] memory b_0 = [_proof[2], _proof[3]];
        uint256[2] memory b_1 = [_proof[4], _proof[5]];
        uint256[2] memory c = [_proof[6], _proof[7]];
        uint256[4] memory input = [_tx[0], _tx[1], _tx[5], uint256(uint160(address(_recipient)))];
        require(
            wsv.verifyProof(a, [b_0, b_1], c, input),
            "eddsa signature is not valid"
        );

        // transfer token on tokenContract
        if (_tx[7] == 1) {
            // ETH
            _recipient.transfer(_tx[6]);
        } else {
            // // ERC20
            // address erc20 = registry.registry(_tx[7]);
            // require(
            //     IERC20(erc20).transfer(_recipient, _tx[6]),
            //     "transfer failed"
            // );
        }
        emit Withdrawn(_tx, _recipient);
    }

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
            if ((depositQueueSize & (uint256(1) << i)) > 0) _heights[_i++] = i;
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
