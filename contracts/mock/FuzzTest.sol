// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {OmronDeposit} from "../OmronDeposit.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "hardhat/console.sol";

contract MockToken is ERC20 {
    constructor() ERC20("MockToken", "MTK") {
        _mint(msg.sender, 10000 * 10 ** 18);
    }
}

contract OmronDepositTest is OmronDeposit {
    MockToken public token;
    bool private initialized = false;
    address[] public tokens = [address(token)];

    constructor() OmronDeposit(msg.sender, tokens) {}

    function echidna_points_decimals_18() public returns (bool) {
        return (POINTS_DECIMALS == 18);
    }

    function echidna_test_whitelisted_tokens() public returns (bool) {
        address[] memory tokens = allWhitelistedTokens;
        for (uint i = 0; i < tokens.length; i++) {
            if (!whitelistedTokens[tokens[i]]) {
                return false;
            }
        }
        return true;
    }

    function echidna_test_user_info() public returns (bool) {
        address userAddress = address(this);
        (uint256 pointsPerHour, , uint256 pointBalance) = this.getUserInfo(
            userAddress
        );
        return pointsPerHour == 0 && pointBalance == 0;
    }
}
