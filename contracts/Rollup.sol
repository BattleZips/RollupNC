//SPDX-License-Identifier: GNU GPLv3
pragma solidity ^0.8.15;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
// import './interfaces/IRollup.sol';
import "./interfaces/ITokenRegistry.sol";
import "./interfaces/IVerifier.sol";
import "./libraries/IncrementalBinaryTree.sol";
import "./libraries/PackedPairings.sol";
import "./libraries/Poseidon.sol";

/// @title implementation of Non-custodial rollup
contract RollupNC {
    using IncrementalBinaryTree for IncrementalTreeData;

    PoseidonT3 public poseidonT3;
    PoseidonT6 public poseidonT6;
    IVerifier public usv; // update state verifier
    IVerifier public wsv; // withdraw signature verifier
    IncrementalBinaryTree public merkleTree; // incremental binary tree of account balances
    ITokenRegistry public registry;

    uint256 public constant DEPTH;
    uint256 public constant ZERO;
    uint256[] constant ZERO_CACHE;

    uint256 public currentRoot;
    address public coordinator;
    uint256[] public pendingDeposits;
    uint256 public queueNumber;
    uint256 public depositSubtreeHeight;
    uint256 public updateNumber;

    // (queueNumber => [pubkey_x, pubkey_y, balance, nonce, token_type])
    mapping(uint256 => uint256) public deposits; //leaf idx => leafHash
    mapping(uint256 => uint256) public updates; //txRoot => update idx

    event RegisteredToken(uint256 tokenType, address tokenContract);
    event RequestDeposit(uint256[2] pubkey, uint256 amount, uint256 tokenType);
    event UpdatedState(uint256 currentRoot, uint256 oldRoot, uint256 txRoot);
    event Withdraw(uint256[9] accountInfo, address recipient);

    /// @dev construct a new non-custodial on-chain rollup
    /// @param _addresses: array of addresses used in the rollup contract
    ///   [0]: poseidonT3 library contract
    ///   [1]: poseidonT6 library contract
    ///   [2]: Update State Verifier contract
    ///   [3]: Withdrawal Signature Verifier contract
    ///   [4]: incremental binary tree library contract
    ///   [5]: ollup token registry contract
    /// @param _depth: depth of account/ transaction balance merkle tree
    /// @param _zero: the value to use for an empty leaf in a merkle tree
    /// @param _zeroCache: array of precomputed roots for zero's at different heights
    constructor(
        address[6] memory _addresses,
        uint256 _depth,
        uint256 _zero,
        uint256[_zero] memory _zeroCache
    ) public {
        // assign contract references
        poseidonT3 = PoseidonT3(_addresses[0]);
        poseidonT6 = PoseidonT6(_addresses[1]);
        usv = IVerifier(_addresses[2]);
        wsv = IVerifier(_addresses[3]);
        merkleTree = IncrementalBinaryTree(_addresses[4]);
        registry = ITokenRegistry(_addresses[5]);
        // assign primative variables
        DEPTH = _depth;
        ZERO = _zero;
        ZERO_CACHE = _zeroCache;
        currentRoot = ZERO_CACHE[DEPTH];
        coordinator = msg.sender;
    }

    modifier onlyCoordinator() {
        assert(msg.sender == coordinator);
        _;
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
        // handle token types
        if (tokenType == 0) {
            require(
                msg.sender == coordinator,
                "tokenType 0 is reserved for coordinator"
            );
            require(
                amount == 0 && msg.value == 0,
                "tokenType 0 does not have real value"
            );
        } else if (tokenType == 1) {
            require(
                msg.value > 0 && msg.value >= amount,
                "msg.value must at least equal stated amount in wei"
            );
        } else if (tokenType > 1) {
            require(amount > 0, "token deposit must be greater than 0");
            address tokenAddress = registry.registeredTokens(tokenType);
            require(
                IERC20(tokenAddress).transferFrom(
                    msg.sender,
                    address(this),
                    amount
                ),
                "token transfer not approved"
            );
        }

        uint256[] memory depositArray = new uint256[](5);
        depositArray[0] = pubkey[0];
        depositArray[1] = pubkey[1];
        depositArray[2] = amount;
        depositArray[3] = 0;
        depositArray[4] = tokenType;

        uint256 depositHash = poseidonT6(depositArray);
        pendingDeposits.push(depositHash);
        emit RequestDeposit(pubkey, amount, tokenType);
        queueNumber++;
        uint256 tmpDepositSubtreeHeight = 0;
        uint256 tmp = queueNumber;
        while (tmp % 2 == 0) {
            pendingDeposits[pendingDeposits.length - 2] = poseidonT3([
                pendingDeposits[pendingDeposits.length - 2],
                pendingDeposits[pendingDeposits.length - 1]
            ]);
            // removeDeposit(pendingDeposits.length - 1);
            tmp = tmp / 2;
            tmpDepositSubtreeHeight++;
        }
        if (tmpDepositSubtreeHeight > depositSubtreeHeight) {
            depositSubtreeHeight = tmpDepositSubtreeHeight;
        }
    }

    // // coordinator adds certain number of deposits to balance tree
    // // coordinator must specify subtree index in the tree since the deposits
    // // are being inserted at a nonzero height
    function processDeposits(
        uint256 subtreeDepth,
        uint256[] memory subtreePosition,
        uint256[] memory subtreeProof
    ) public onlyCoordinator returns (uint256) {
        uint256 emptySubtreeRoot = mimcMerkle.zeroCache(subtreeDepth); //empty subtree of height 2
        require(
            currentRoot ==
                mimcMerkle.getRootFromProof(
                    emptySubtreeRoot,
                    subtreePosition,
                    subtreeProof
                ),
            "specified subtree is not empty"
        );
        currentRoot = mimcMerkle.getRootFromProof(
            pendingDeposits[0],
            subtreePosition,
            subtreeProof
        );
        removeDeposit(0);
        queueNumber = queueNumber - 2**depositSubtreeHeight;
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

    // helper functions
    function removeDeposit(uint256 index) internal returns (uint256[] memory) {
        require(index < pendingDeposits.length, "index is out of bounds");

        for (uint256 i = index; i < pendingDeposits.length - 1; i++) {
            pendingDeposits[i] = pendingDeposits[i + 1];
        }
        delete pendingDeposits[pendingDeposits.length - 1];
        pendingDeposits.length--;
        return pendingDeposits;
    }
}
