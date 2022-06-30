//SPDX-License-Identifier: GNU GPLv3
pragma solidity ^0.8.15;

/**
 * @title Interface for a registry of ERC20 assets that can be locked into and traded withinn the rollup
 * @dev registeredToken[0] is always the current EVM's native gas token (ether on ethereum)
 */
abstract contract ITokenRegistry {
    /// EVENTS ///
    event RollupSet(address _rollup);
    event TokenPending(address _token);
    event TokenRegistered(uint256 _index);

    /// MODIFIERS ///
    /* Ensure a function can only be called by the rollup smart contract */
    modifier onlyRollup() {
        assert(msg.sender == rollup);
        _;
    }

    /* Ensure a function can only be called by the permissioned sequencer */
    modifier onlyCoordinator() {
        assert(msg.sender == coordinator);
        _;
    }

    /// VARIABLES ///
    address public coordinator; // permissioned sequencer address
    address public rollup; // merkle state CRUD contract

    mapping(address => TokenRegistration) public state; // map erc20 tokens to their state within the rollup
    mapping(uint256 => address) public registry; // index of registered ERC20 tokens on the rollup
    uint256 public registryIndex; // boundary of registery (alternatively: numTokens)

    /// FUNCTIONS ///
    /**
     * Set the address of the contract managing rollup state in a merkle tree
     * @dev modifier onlyCoordinator
     *
     * @param _rollup - the contract address to designate as the rollup within the registry contract
     */
    function setRollup(address _rollup) public virtual;

    /**
     * Propose a new token be added to the roll-up's exchange network
     *
     * @param _token - the contract address of the ERC20 proposed for registry
     */
    function registerToken(address _token) public virtual;

    /**
     * Centralized approval of ERC20 token registry requests
     * @dev modifier onlyRollup
     *
     * @param _token - the contract address of the ERC20 to approve registry proposal for
     */
    function approveToken(address _token) public virtual;
}

enum TokenRegistration { None, Pending, Registered }