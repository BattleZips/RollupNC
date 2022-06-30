//SPDX-License-Identifier: GNU GPLv3
pragma solidity ^0.8.15;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./IMiMC.sol";
import "./IMiMCMerkle.sol";
import "./ITokenRegistry.sol";
import "./IVerifier.sol";

/**
 * @title Interface for off-chain transaction roll-up logic
 */
abstract contract IRollup {
    /// EVENTS ///
    event RegisteredToken(uint256 _index, address _address);
    event RequestDeposit(uint256[2] _pubkey, uint256 _amount, uint256 _token);
    event UpdatedState(uint256 _current, uint256 _old, uint256 _tx);
    event Withdraw(uint256[9] _info, address _to);

    /// MODIFIERS ///

    /* Ensure a function can only be called by the permissioned sequencer */
    modifier onlyCoordinator() {
        assert(msg.sender == coordinator);
        _;
    }

    /// VARIABLES ///
    IMiMC public mimc;
    IMiMCMerkle public merkle;
    ITokenRegistry public registry;

    uint256 public currentRoot;
    address public coordinator;
    uint256[] public pendingDeposits;
    uint256 public queueNumber;
    uint256 public depositSubtreeHeight;
    uint256 public updateNumber;

    uint256 public BAL_DEPTH = 4;
    uint256 public TX_DEPTH = 2;

    // (queueNumber => [pubkey_x, pubkey_y, balance, nonce, token_type])
    mapping(uint256 => uint256) public deposits; //leaf idx => leafHash
    mapping(uint256 => uint256) public updates; //txRoot => update idx

    constructor(
        address _mimcContractAddr,
        address _mimcMerkleContractAddr,
        address _tokenRegistryAddr
    ) public {
        mimc = IMiMC(_mimcContractAddr);
        merkle = IMiMCMerkle(_mimcMerkleContractAddr);
        registry = ITokenRegistry(_tokenRegistryAddr);
        currentRoot = merkle.zeroCache(BAL_DEPTH);
        coordinator = msg.sender;
        queueNumber = 0;
        depositSubtreeHeight = 0;
        updateNumber = 0;
    }

    /**
     * @dev modifier onlyCoordinator
     */
    function updateState(
        uint256[2] memory a,
        uint256[2][2] memory b,
        uint256[2] memory c,
        uint256[3] memory input
    ) public virtual;

    // user tries to deposit ERC20 tokens
    function deposit(
        uint256[2] memory pubkey,
        uint256 amount,
        uint256 tokenType
    ) public payable virtual;

    // coordinator adds certain number of deposits to balance tree
    // coordinator must specify subtree index in the tree since the deposits
    // are being inserted at a nonzero height
    /**
     * @dev modifier onlyCoordinator
     */
    function processDeposits(
        uint256 subtreeDepth,
        uint256[] memory subtreePosition,
        uint256[] memory subtreeProof
    ) public virtual returns (uint256);

    function withdraw(
        uint256[9] memory txInfo, //[pubkeyX, pubkeyY, index, toX ,toY, nonce, amount, token_type_from, txRoot]
        uint256[] memory position,
        uint256[] memory proof,
        address payable recipient,
        uint256[2] memory a,
        uint256[2][2] memory b,
        uint256[2] memory c
    ) public {
        require(txInfo[7] > 0, "invalid tokenType");
        require(updates[txInfo[8]] > 0, "txRoot does not exist");
        uint256[] memory txArray = new uint256[](8);
        for (uint256 i = 0; i < 8; i++) {
            txArray[i] = txInfo[i];
        }
        uint256 txLeaf = mimcMerkle.hashMiMC(txArray);
        require(
            txInfo[8] == mimcMerkle.getRootFromProof(txLeaf, position, proof),
            "transaction does not exist in specified transactions root"
        );

        // message is hash of nonce and recipient address
        uint256[] memory msgArray = new uint256[](2);
        msgArray[0] = txInfo[5];
        msgArray[1] = uint256(recipient);

        require(
            withdraw_verifyProof(
                a,
                b,
                c,
                [txInfo[0], txInfo[1], mimcMerkle.hashMiMC(msgArray)]
            ),
            "eddsa signature is not valid"
        );

        // transfer token on tokenContract
        if (txInfo[7] == 1) {
            // ETH
            recipient.transfer(txInfo[6]);
        } else {
            // ERC20
            address tokenContractAddress = tokenRegistry.registeredTokens(
                txInfo[7]
            );
            tokenContract = IERC20(tokenContractAddress);
            require(
                tokenContract.transfer(recipient, txInfo[6]),
                "transfer failed"
            );
        }

        emit Withdraw(txInfo, recipient);
    }

    //call methods on TokenRegistry contract

    function registerToken(address tokenContractAddress) public {
        tokenRegistry.registerToken(tokenContractAddress);
    }

    function approveToken(address tokenContractAddress) public onlyCoordinator {
        tokenRegistry.approveToken(tokenContractAddress);
        emit RegisteredToken(tokenRegistry.numTokens(), tokenContractAddress);
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
