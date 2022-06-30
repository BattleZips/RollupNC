//SPDX-License-Identifier: GNU GPLv3
pragma solidity ^0.8.15;

import "./interfaces/ITokenRegistry.sol";

/**
 * @title Registry of ERC20 tokens that the Rollup can process
 * @notice documented in ITokenRegistry
 */
contract TokenRegistry is ITokenRegistry {
    /**
     * Instantiate the RollupNC's ERC20 Token Registry
     * @param _coordinator - the address of the permissioned off-chain roll-up sequencer
     */
    constructor(address _coordinator) {
        coordinator = _coordinator;
        registryIndex = 1; // ETH
    }

    function setRollup(address _rollup) public override onlyCoordinator {
        rollup = _rollup;
        emit RollupSet(_rollup);
    }

    function registerToken(address _token) public override {
        require(
            state[_token] == TokenRegistration.None,
            "Token already pending/ registered!"
        );
        state[_token] = TokenRegistration.Pending;
        emit TokenPending(_token);
    }

    function approveToken(address _token) public override onlyRollup {
        require(
            state[_token] == TokenRegistration.Pending,
            "Token is not pending registration!"
        );
        registryIndex += 1;
        registry[registryIndex] = _token;
        state[_token] = TokenRegistration.Registered;
        emit TokenRegistered(registryIndex);
    }
}
