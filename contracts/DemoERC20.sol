//SPDX-License-Identifier: GNU GPLv3
pragma solidity ^0.8.15;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title Basic ERC20 with freely mintable tokens
 * @notice 18 decimal places
 */
contract DemoERC20 is ERC20 {

    /**
     * Instantiate a test ERC20 contract for demonstrating rollup functionality
     * @param _name - the erc20 token name
     * @param _symbol - the erc20 token symbol/ ticker
     */
    constructor(string memory _name, string memory _symbol) ERC20(_name, _symbol) {
    }

    /**
     * Mint tokens to a given address with no restrictions
     * @param _to - the address that receives the minted tokens
     * @param _amount - the amount of tokens to mint to the address
     */
    function mint(address _to, uint256 _amount) public {
        _mint(_to, _amount);
    }
}
