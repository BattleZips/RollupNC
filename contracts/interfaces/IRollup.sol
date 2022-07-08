// //SPDX-License-Identifier: GNU GPLv3
// pragma solidity ^0.8.15;

// import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
// import "./IMiMC.sol";
// import "./IMiMCMerkle.sol";
// import "./ITokenRegistry.sol";
// import "./IVerifier.sol";

// /**
//  * @title Interface for off-chain transaction roll-up logic
//  */
// abstract contract IRollup {
//     /// EVENTS ///
//     event RegisteredToken(uint256 _index, address _address);
//     event RequestDeposit(uint256[2] _pubkey, uint256 _amount, uint256 _token);
//     event UpdatedState(uint256 _current, uint256 _old, uint256 _tx);
//     event Withdraw(uint256[9] _info, address _to);

//     /// MODIFIERS ///

//     /* Ensure a function can only be called by the permissioned sequencer */
//     modifier onlyCoordinator() {
//         assert(msg.sender == coordinator);
//         _;
//     }

//     /// VARIABLES ///
//     IMiMC public mimc;
//     IMiMCMerkle public merkle;
//     ITokenRegistry public registry;
//     IVerifier public usv; // usv = update state verifier
//     IVerifier public wsv; // wsv = withdraw signature verifier

//     uint256 public currentRoot;
//     address public coordinator;
//     uint256[] public pendingDeposits;
//     uint256 public queueNumber;
//     uint256 public depositSubtreeHeight;
//     uint256 public updateNumber;

//     uint256 public BAL_DEPTH = 4;
//     uint256 public TX_DEPTH = 2;

//     // (queueNumber => [pubkey_x, pubkey_y, balance, nonce, token_type])
//     mapping(uint256 => uint256) public deposits; //leaf idx => leafHash
//     mapping(uint256 => uint256) public updates; //txRoot => update idx

//     /**
//      * @dev modifier onlyCoordinator
//      */
//     function updateState(
//         uint256[2] memory a,
//         uint256[2][2] memory b,
//         uint256[2] memory c,
//         uint256[3] memory input
//     ) public virtual;

//     // user tries to deposit ERC20 tokens
//     function deposit(
//         uint256[2] memory pubkey,
//         uint256 amount,
//         uint256 tokenType
//     ) public payable virtual;

//     // coordinator adds certain number of deposits to balance tree
//     // coordinator must specify subtree index in the tree since the deposits
//     // are being inserted at a nonzero height
//     /**
//      * @dev modifier onlyCoordinator
//      */
//     function processDeposits(
//         uint256 subtreeDepth,
//         uint256[] memory subtreePosition,
//         uint256[] memory subtreeProof
//     ) public virtual returns (uint256);

//     function withdraw(
//         uint256[9] memory txInfo, //[pubkeyX, pubkeyY, index, toX ,toY, nonce, amount, token_type_from, txRoot]
//         uint256[] memory position,
//         uint256[] memory proof,
//         address payable recipient,
//         uint256[2] memory a,
//         uint256[2][2] memory b,
//         uint256[2] memory c
//     ) public virtual;

//     //call methods on TokenRegistry contract

//     /**
//      * Register a new token within the rollup
//      * @param  _token - the address of the erc20 token contract to request the token
//      */
//     function registerToken(address _token) public virtual;

//     /**
//      * Approve a token 
//      * @dev modifier onlyCoordinator
//      */
//     function approveToken(address tokenContractAddress) public virtual;

//     /**
//      * Internal helper function for removing deposit from pending queue
//      * @param _index - the index of the deposit in the queue to remove
//      */
//     function removeDeposit(uint256 _index) internal returns (uint256[] memory) {
//         require(_index < pendingDeposits.length, "index is out of bounds");

//         for (uint256 i = _index; i < pendingDeposits.length - 1; i++) {
//             pendingDeposits[i] = pendingDeposits[i + 1];
//         }
//         delete pendingDeposits[pendingDeposits.length - 1];
//         pendingDeposits.length--;
//         return pendingDeposits;
//     }
// }
